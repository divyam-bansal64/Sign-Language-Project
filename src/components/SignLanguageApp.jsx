import React, { useState, useRef, useEffect } from "react";
import Fuse from "fuse.js";
import Papa from "papaparse";
import { preprocessTextForSignLanguage } from "../nlp";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import Webcam from "react-webcam";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import nlp from "compromise";
import {
  AppBar, Toolbar, Typography, Container, Tabs, Tab, Box, Button,
  TextField, Paper, Stack, IconButton, CircularProgress, useTheme,
  Alert, Chip, Divider
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import ReplayIcon from "@mui/icons-material/Replay";
import TranslateIcon from "@mui/icons-material/Translate";
import GestureIcon from "@mui/icons-material/Gesture";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CameraAltIcon from "@mui/icons-material/CameraAlt";

export default function SignLanguageApp() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [textInput, setTextInput] = useState("");
  const [convertedSigns, setConvertedSigns] = useState([]);
  const [loading, setLoading] = useState(false);

  // NLP Analysis state
  const [nlpAnalysis, setNlpAnalysis] = useState(null);
  const [processedText, setProcessedText] = useState("");

  // Speech Recognition
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const [micPermission, setMicPermission] = useState(null);

  // Gesture Recognition
  const webcamRef = useRef(null);
  const gestureRecognizer = useRef(null);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [detectedGestures, setDetectedGestures] = useState([]);
  const [currentGesture, setCurrentGesture] = useState("");
  const [gestureLoading, setGestureLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  // CSV Data and Fuzzy Search
  const [phraseMap, setPhraseMap] = useState({});
  const [wordMap, setWordMap] = useState({});
  const [fusePhrases, setFusePhrases] = useState(null);
  const [fuseWords, setFuseWords] = useState(null);
  const [wordsLoaded, setWordsLoaded] = useState(false);
  const [phrasesLoaded, setPhrasesLoaded] = useState(false);
  const [csvLoaded, setCsvLoaded] = useState(false);

  // Check microphone permissions
  useEffect(() => {
    const checkMicrophonePermission = async () => {
      if (!browserSupportsSpeechRecognition) {
        setMicPermission(false);
        return;
      }
      try {
        const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost';
        if (!isSecureContext) {
          setMicPermission(false);
          return;
        }
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        if (permissionStatus.state === 'granted') {
          setMicPermission(true);
        } else if (permissionStatus.state === 'denied') {
          setMicPermission(false);
        } else {
          setMicPermission(null);
        }
        permissionStatus.onchange = () => {
          setMicPermission(permissionStatus.state === 'granted');
        };
      } catch (error) {
        setMicPermission(false);
      }
    };
    checkMicrophonePermission();
  }, [browserSupportsSpeechRecognition]);

  // Load CSV data for sign language mapping
  useEffect(() => {
    const loadCSVData = async () => {
      try {
        // Load phrases CSV
        Papa.parse(`${process.env.PUBLIC_URL}/phrases.csv`, {
          download: true,
          header: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              console.error("Phrases CSV errors:", results.errors);
              return;
            }
            const phrases = results.data.reduce((acc, row) => {
              if (row.phrase && row.filename) {
                acc[row.phrase.toLowerCase().trim()] = row.filename.trim();
              }
              return acc;
            }, {});
            setPhraseMap(phrases);
            setFusePhrases(new Fuse(Object.keys(phrases), { threshold: 0.3 }));
            setPhrasesLoaded(true);
            console.log("Loaded phrases:", Object.keys(phrases).length);
          },
          error: (error) => {
            console.error("Error loading phrases.csv:", error);
          }
        });


        // Load words CSV
        Papa.parse(`${process.env.PUBLIC_URL}/words.csv`, {
          download: true,
          header: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              console.error("Words CSV errors:", results.errors);
              return;
            }
            const words = results.data.reduce((acc, row) => {
              if (row.word && row.filename) {
                acc[row.word.toLowerCase().trim()] = row.filename.trim();
              }
              return acc;
            }, {});
            setWordMap(words);
            setFuseWords(new Fuse(Object.keys(words), { threshold: 0.4 }));
            setWordsLoaded(true);
            console.log("Loaded words:", Object.keys(words).length);
          },
          error: (error) => {
            console.error("Error loading words.csv:", error);
          }
        });
      } catch (error) {
        console.error("Error loading CSV data:", error);
      }
    };

    loadCSVData();
  }, []);

          useEffect(() => {
  if (phrasesLoaded && wordsLoaded) {
    setCsvLoaded(true);
  }
}, [phrasesLoaded, wordsLoaded]);

  // Load MediaPipe Gesture Recognition model
  useEffect(() => {
    async function loadModel() {
      const modelPath = `${process.env.PUBLIC_URL}/models/gesture_recognizer.task`;
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        gestureRecognizer.current = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: "GPU"
          },
          runningMode: "VIDEO"
        });
        setModelLoaded(true);
      } catch (err) {
        try {
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
          );
          gestureRecognizer.current = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelPath,
              delegate: "CPU"
            },
            runningMode: "VIDEO"
          });
          setModelLoaded(true);
        } catch (fallbackErr) {
          setModelLoaded(false);
        }
      }
    }
    loadModel();
  }, []);

  // Process webcam frames for gesture recognition
  useEffect(() => {
    let interval;
    const processFrame = async () => {
      if (!webcamRef.current?.video || !gestureRecognizer.current || !modelLoaded) {
        return;
      }
      try {
        const video = webcamRef.current.video;
        if (video.readyState >= 2) {
          const result = await gestureRecognizer.current.recognizeForVideo(
            video,
            Date.now()
          );
          if (result.gestures && result.gestures.length > 0) {
            const gesture = result.gestures[0][0].categoryName;
            const confidence = result.gestures[0][0].score;
            if (confidence > 0.7) {
              setCurrentGesture(gesture);
              setDetectedGestures(prev => {
                const newGesture = { gesture, confidence, timestamp: Date.now() };
                const filtered = prev.filter(g => g.gesture !== gesture);
                return [newGesture, ...filtered].slice(0, 5);
              });
            }
          } else {
            setCurrentGesture("");
          }
        }
      } catch (error) {
        setCurrentGesture("");
      }
    };
    if (webcamEnabled && modelLoaded) {
      interval = setInterval(processFrame, 300);
      setGestureLoading(true);
      setTimeout(() => setGestureLoading(false), 3000);
    } else {
      setGestureLoading(false);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [webcamEnabled, modelLoaded]);

  // Advanced NLP processing using Compromise
  // Advanced NLP processing using Compromise
const processTextWithNLP = (text) => {
  try {
    const doc = nlp(text);
    
    // Basic linguistic analysis
    const analysis = {
      original: text,
      sentences: doc.sentences().out('array'),
      nouns: doc.nouns().out('array'),
      verbs: doc.verbs().out('array'),
      adjectives: doc.adjectives().out('array'),
      wordCount: doc.wordCount(),
    };

    // Use your existing preprocessTextForSignLanguage function
    const signLanguageWords = preprocessTextForSignLanguage(text);
    
    return {
      analysis,
      simplified: signLanguageWords.join(' '),
      signLanguageReady: signLanguageWords
    };
  } catch (error) {
    console.error("NLP processing failed:", error);
    
    // Complete fallback
    const words = text.toLowerCase().split(' ').filter(word => word.trim());
    return {
      analysis: {
        original: text,
        sentences: [text],
        nouns: [],
        verbs: [],
        adjectives: [],
        wordCount: words.length,
      },
      simplified: text,
      signLanguageReady: words
    };
  }
};



  // Speech recognition functions
  const startListening = async () => {
    try {
      if (!browserSupportsSpeechRecognition) {
        alert("Your browser doesn't support speech recognition. Please use Chrome.");
        return;
      }
      const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost';
      if (!isSecureContext) {
        alert("Speech recognition requires HTTPS or localhost for security reasons.");
        return;
      }
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission(true);
      await SpeechRecognition.startListening({
        continuous: true,
        language: 'en-US',
        interimResults: false
      });
    } catch (error) {
      setMicPermission(false);
      if (error.name === 'NotAllowedError') {
        alert("Microphone access denied. Please allow microphone access in your browser settings and try again.");
      } else if (error.name === 'NotFoundError') {
        alert("No microphone found. Please connect a microphone and try again.");
      } else if (error.name === 'NotSupportedError') {
        alert("Speech recognition is not supported in your browser. Please use Chrome.");
      } else {
        alert("Error accessing microphone: " + error.message);
      }
    }
  };
  const stopListening = () => {
    try { SpeechRecognition.stopListening(); } catch (error) {}
  };
  const handleResetTranscript = () => {
    try { resetTranscript(); } catch (error) {}
  };

  // Text to sign language conversion
  // Text to sign language conversion
const handleTextToSign = () => {
  setLoading(true);

  setTimeout(() => {
    const input = textInput.trim().toLowerCase();

    // Run NLP processing
    const nlpResult = preprocessTextForSignLanguage(input);
    const { simplified, originalTokens } = nlpResult;

    // Store analysis for UI display
    setNlpAnalysis({
      simplified,
      originalTokens
    });
    setProcessedText(simplified.join(" "));

    let signs = [];

    // --- 1. Try exact phrase match (using original input) ---
    if (phraseMap[input]) {
      const filename = phraseMap[input];
      signs = [{
        type: "phrase",
        key: input,
        src: `${process.env.PUBLIC_URL}/videos/phrases/${filename}`
      }];
    }

    // --- 2. Fuzzy phrase match ---
    else if (fusePhrases) {
      const phraseResults = fusePhrases.search(input);
      if (phraseResults.length > 0 && phraseResults[0].score < 0.4) {
        const matchedPhrase = phraseResults[0].item;
        signs = [{
          type: "phrase",
          key: matchedPhrase,
          src: `${process.env.PUBLIC_URL}/videos/phrases/${phraseMap[matchedPhrase]}`
        }];
      }
    }

    // --- 3. Word-by-word fallback (use originalTokens for matching) ---
    if (signs.length === 0 && fuseWords) {
      signs = originalTokens.map(word => {
        let src = null;
        let key = word;

        // Exact match
        if (wordMap[word]) {
          src = `${process.env.PUBLIC_URL}/images/words/${wordMap[word]}`;
        }
        // Fuzzy match
        else {
          const wordResults = fuseWords.search(word);
          if (wordResults.length > 0 && wordResults[0].score < 0.5) {
            key = wordResults[0].item;
            src = `${process.env.PUBLIC_URL}/images/words/${wordMap[key]}`;
          }
        }

        return {
          type: "word",
          key,
          src,
          original: word
        };
      });
    }

    // --- 4. Save output signs ---
    setConvertedSigns(signs);
    setLoading(false);
  }, 800);
};





  // Webcam control
  const toggleWebcam = async () => {
    if (webcamEnabled) {
      setWebcamEnabled(false);
      setCurrentGesture("");
      setDetectedGestures([]);
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setWebcamEnabled(true);
      } catch (error) {
        alert("Camera access required for gesture detection. Please allow camera access and try again.");
      }
    }
  };

  // Use voice transcript
  const handleUseTranscript = () => {
    setTextInput(transcript);
    resetTranscript();
  };

  return (
    <>
      <AppBar position="static" color="primary" enableColorOnDark>
        <Toolbar>
          <GestureIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Advanced Sign Language Converter
          </Typography>
          <Button color="inherit">
            Dual Channel AI
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
          <Tabs
            value={tab}
            onChange={(_, val) => setTab(val)}
            centered
            textColor="primary"
            indicatorColor="primary"
            sx={{ mb: 3 }}
          >
            <Tab icon={<TranslateIcon />} label="Speech/Text to Sign" />
            <Tab icon={<CameraAltIcon />} label="Sign to Text Detection" />
          </Tabs>

          {/* Speech/Text to Sign Tab */}
          {tab === 0 && (
            <Box>
              <Stack spacing={3}>
                {/* Voice Input Section */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    <MicIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Voice Input
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <IconButton
                      color={listening ? "success" : "default"}
                      onClick={async () => {
                        if (listening) {
                          stopListening();
                        } else {
                          await startListening();
                        }
                      }}
                      disabled={!browserSupportsSpeechRecognition || micPermission === false}
                      size="large"
                      title={
                        micPermission === false 
                          ? "Microphone access denied - check browser settings" 
                          : listening 
                            ? "Stop recording" 
                            : "Start recording"
                      }
                    >
                      <MicIcon />
                    </IconButton>
                    <IconButton 
                      onClick={stopListening} 
                      color="error"
                      disabled={!listening}
                      title="Stop recording"
                    >
                      <StopIcon />
                    </IconButton>
                    <IconButton 
                      onClick={handleResetTranscript} 
                      color="warning"
                      disabled={!transcript}
                      title="Reset transcript"
                    >
                      <ReplayIcon />
                    </IconButton>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleUseTranscript}
                      disabled={!transcript}
                    >
                      Use Voice Text
                    </Button>
                  </Stack>
                  {!browserSupportsSpeechRecognition && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.
                    </Alert>
                  )}
                  {micPermission === false && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      Microphone access denied. Please allow microphone access in browser settings.
                    </Alert>
                  )}
                  {micPermission === null && (
                    <Typography color="warning" variant="body2" sx={{ mt: 1 }}>
                      ⚠️ Microphone permission not determined. Click the microphone button to request access.
                    </Typography>
                  )}
                  {micPermission === true && !listening && (
                    <Typography color="success" variant="body2" sx={{ mt: 1 }}>
                      ✅ Microphone ready. Click the microphone button to start speaking.
                    </Typography>
                  )}
                  {listening && (
                    <Typography color="primary" variant="body2" sx={{ mt: 1 }}>
                      🎤 Listening... Speak now!
                    </Typography>
                  )}
                  {transcript && (
                    <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Voice Input:
                      </Typography>
                      <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                        "{transcript}"
                      </Typography>
                    </Paper>
                  )}
                </Paper>
                {/* Text Input Section */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    <SmartToyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Text Input & NLP Processing
                  </Typography>
                  <TextField
                    label="Enter text to convert to sign language"
                    variant="outlined"
                    fullWidth
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    multiline
                    minRows={3}
                    sx={{ mb: 2 }}
                    placeholder="Type something like 'hello' or 'i am happy'"
                  />
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleTextToSign}
                    startIcon={<TranslateIcon />}
                    disabled={!textInput.trim() || !csvLoaded}
                    size="large"
                  >
                    {csvLoaded ? "Convert to Sign Language" : "Loading Database..."}
                  </Button>
                </Paper>
                {/* NLP Analysis Display */}
                {nlpAnalysis && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      NLP Analysis (Compromise.js)
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2">Processed Text:</Typography>
                        <Typography variant="body2" color="primary">
                          {processedText}
                        </Typography>
                      </Box>
                      <Divider />
                      <Stack direction="row" spacing={4} flexWrap="wrap">
                        {nlpAnalysis.nouns.length > 0 && (
                          <Box>
                            <Typography variant="subtitle2">Nouns:</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {nlpAnalysis.nouns.map((noun, idx) => (
                                <Chip key={idx} label={noun} size="small" color="primary" />
                              ))}
                            </Stack>
                          </Box>
                        )}
                        {nlpAnalysis.verbs.length > 0 && (
                          <Box>
                            <Typography variant="subtitle2">Verbs:</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {nlpAnalysis.verbs.map((verb, idx) => (
                                <Chip key={idx} label={verb} size="small" color="secondary" />
                              ))}
                            </Stack>
                          </Box>
                        )}
                        {nlpAnalysis.adjectives.length > 0 && (
                          <Box>
                            <Typography variant="subtitle2">Adjectives:</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {nlpAnalysis.adjectives.map((adj, idx) => (
                                <Chip key={idx} label={adj} size="small" color="success" />
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                )}
                {/* Sign Language Output */}
                {loading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                    <CircularProgress size={60} />
                    <Typography sx={{ ml: 2, alignSelf: 'center' }}>
                      Converting to sign language...
                    </Typography>
                  </Box>
                ) : (
                  convertedSigns.length > 0 && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Sign Language Output
                      </Typography>
                      <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center">
                        {convertedSigns.map((sign, idx) => (
                          <Box key={idx} sx={{ textAlign: "center", mb: 2 }}>
                            {sign.type === "phrase" ? (
                              <Box>
                                <video
                                  key={sign.src}
                                  src={sign.src}
                                  controls
                                  autoPlay
                                  muted
                                  style={{
                                    maxWidth: "300px",
                                    maxHeight: "200px",
                                    borderRadius: theme.shape.borderRadius
                                  }}
                                  onError={(e) => {
                                    console.error("Video failed to load:", sign.src);
                                  }}
                                  onLoadStart={() => {
                                    console.log("Video started loading:", sign.src);
                                  }}
                                />
                                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                  Phrase: {sign.key}
                                </Typography>
                              </Box>
                            ) : (
                              <Box>
                                {sign.src ? (
                                  <img
                                    src={sign.src}
                                    alt={sign.key}
                                    style={{
                                      width: 150,
                                      height: 150,
                                      objectFit: "cover",
                                      borderRadius: theme.shape.borderRadius,
                                      border: "2px solid #ddd"
                                    }}
                                    onError={(e) => {
                                      console.error("Image failed to load:", sign.src);
                                    }}
                                  />
                                ) : (
                                  <Box
                                    sx={{
                                      width: 150,
                                      height: 150,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '2px dashed #ccc',
                                      borderRadius: 1,
                                      bgcolor: 'grey.100'
                                    }}
                                  >
                                    <Typography color="error" variant="caption" textAlign="center">
                                      No sign found for<br/>"{sign.key}"
                                    </Typography>
                                  </Box>
                                )}
                                <Typography variant="caption" display="block" sx={{ mt: 1, fontWeight: 'bold' }}>
                                  {sign.key}
                                </Typography>
                                {sign.original && sign.original !== sign.key && (
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    (from: {sign.original})
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </Box>
                        ))}
                      </Stack>
                    </Paper>
                  )
                )}
              </Stack>
            </Box>
          )}

          {/* Sign to Text Detection Tab */}
          {tab === 1 && (
            <Box>
              <Stack spacing={3}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    <CameraAltIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Real-time Sign Language Detection
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Uses MediaPipe AI to detect sign language gestures from your webcam feed.
                    {!modelLoaded && " (Loading AI model...)"}
                  </Typography>
                  <Box sx={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 640,
                    height: 480,
                    mx: 'auto',
                    mb: 2,
                    border: '2px solid #ddd',
                    borderRadius: 1,
                    overflow: 'hidden'
                  }}>
                    {webcamEnabled ? (
                      <Webcam
                        ref={webcamRef}
                        audio={false}
                        screenshotFormat="image/jpeg"
                        width={640}
                        height={480}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onUserMedia={() => {
                          console.log("Webcam stream started");
                        }}
                        onUserMediaError={(error) => {
                          console.error("Webcam error:", error);
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'grey.100'
                        }}
                      >
                        <Typography color="text.secondary" textAlign="center">
                          {!modelLoaded
                            ? "Loading AI model for gesture detection..."
                            : "Click 'Start Detection' to enable webcam"
                          }
                        </Typography>
                      </Box>
                    )}
                    {currentGesture && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 10,
                          left: 10,
                          bgcolor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          px: 2,
                          py: 1,
                          borderRadius: 1
                        }}
                      >
                        <Typography variant="h6">
                          {currentGesture}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Stack direction="row" spacing={2} justifyContent="center">
                    <Button
                      variant="contained"
                      color={webcamEnabled ? "error" : "primary"}
                      onClick={toggleWebcam}
                      startIcon={webcamEnabled ? <StopIcon /> : <CameraAltIcon />}
                      size="large"
                      disabled={!modelLoaded}
                    >
                      {webcamEnabled ? "Stop Detection" : "Start Detection"}
                    </Button>
                  </Stack>
                  {!modelLoaded && (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                      <CircularProgress size={30} />
                      <Typography sx={{ ml: 2 }}>
                        Loading gesture recognition model...
                      </Typography>
                    </Box>
                  )}
                </Paper>
                {detectedGestures.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Recent Detections
                    </Typography>
                    <Stack spacing={1}>
                      {detectedGestures.map((detection, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            p: 1,
                            bgcolor: idx === 0 ? 'primary.light' : 'grey.50',
                            borderRadius: 1
                          }}
                        >
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: idx === 0 ? 'bold' : 'normal',
                              color: idx === 0 ? 'white' : 'text.primary'
                            }}
                          >
                            {detection.gesture}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: idx === 0 ? 'white' : 'text.secondary'
                            }}
                          >
                            {(detection.confidence * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                )}
                {gestureLoading && !currentGesture && (
                  <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }}>
                      Initializing gesture detection...
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </Paper>
      </Container>
      <Box
        component="footer"
        sx={{
          py: 3,
          textAlign: "center",
          bgcolor: "background.paper",
          color: "text.secondary",
          borderTop: '1px solid #eee'
        }}
      >
        <Typography variant="body2">
          &copy; {new Date().getFullYear()} Advanced Sign Language Converter - Dual Channel AI System
        </Typography>
      </Box>
    </>
  );
}

