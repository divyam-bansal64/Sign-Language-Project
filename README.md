# Advanced Sign Language Converter

An AI-powered dual-channel application that converts between **speech/text ↔ sign language**.  
The project integrates **Natural Language Processing (NLP)**, **speech recognition**, and **gesture detection** to make communication more inclusive for people using sign language.

Co-developed by **Divyam Bansal**, **Hitesh Khowal**, and **Hirday Singh**.

## Features

- **Speech to Sign Language**  
  Convert spoken input into sign language using browser-based speech recognition.

- **Text to Sign Language**  
  Type or paste text and get corresponding sign language output with NLP-based simplification.

- **NLP Processing**  
  Uses advanced Natural Language Processing (Compromise.js + custom preprocessing) to analyze input, extract key words, and map them to sign resources.

- **Sign Language Detection (Webcam)**  
  Real-time gesture recognition using a CNN-based model integrated with **MediaPipe Tasks Vision**.

- **Fuzzy Matching with CSV Database**  
  Smart matching of phrases and words (via Fuse.js and PapaParse) to handle typos, synonyms, and approximate matches.

## Tech Stack

### Core Framework
- **React** – Frontend framework for building the user interface.

### Natural Language Processing (NLP)
- **Compromise.js** – Extracts nouns, verbs, adjectives, and sentence structures.
- **Custom Preprocessing** – Simplifies input text into sign-language-ready words.
- **Fuse.js** – Fuzzy matching for approximate word/phrase recognition.
- **PapaParse** – Parses CSV files (`words.csv`, `phrases.csv`) to map text with sign videos/images.

### Speech Recognition
- **react-speech-recognition** – Converts spoken voice input into text using browser APIs.

### Gesture & Vision AI
- **react-webcam** – Integrates webcam feed for real-time gesture detection.
- **MediaPipe Tasks Vision** – Runs the gesture recognition model (GPU/CPU) to detect sign language gestures.

---

## Usage

The application works in two main modes:

### 1. Speech / Text → Sign Language
- **Speech Input**: Click the microphone button, speak, and your speech is transcribed into text.
- **Text Input**: Type or paste any sentence into the text box.
- The text is processed through **NLP** (Compromise.js + custom preprocessing).
- Matching signs are fetched from:
  - **Phrases database** (CSV + video files).
  - **Words database** (CSV + image files).
- Output is shown as **sign language videos or images**.

### 2. Sign Language (Webcam) → Text
- Enable your **webcam** by clicking *Start Detection*.
- The app uses **MediaPipe AI** to detect gestures in real time.
- Recognized signs are displayed as text with **confidence scores**.
- A history of recent detections is shown for reference.

## Contributors

This project was **co-developed** by:

- **Divyam Bansal**
- **Hitesh Khowal**
- **Hirday Singh**

Special thanks to open-source libraries and models that made this project possible.

