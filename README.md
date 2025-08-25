# 🕉 Ganesh Bappa Chatbot  

An **AI-powered conversational chatbot** that lets users talk to **Ganesh Bappa** ✨.  
It supports **text and voice conversations**, with responses delivered in **natural voice** using AI-powered speech synthesis.  

Built with:  
- **Frontend** → React + TailwindCSS  
- **Backend** → Flask (Python)  
- **AI Models** → Gemini API (LLM), Google Speech-to-Text, Edge-TTS (Azure Neural Voice)  

---

## 🚀 Features  
- 🎤 **Voice Input**: Speak to Bappa (via browser mic)  
- 💬 **Text Chat**: Type and get instant replies  
- 🔊 **Voice Output**: Listen to Bappa’s response in natural voice (`en-IN-PrabhatNeural`)  
- ⚡ **Real-Time Processing**: Handles both speech-to-text and text-to-speech  
- 🌐 **Deployed App**: https://ganeshachatbot-production.up.railway.app/

---

## 🏗 System Architecture  

```plaintext
Frontend (React + TailwindCSS)
   │
   │ (REST API calls)
   ▼
Backend (Flask)
   │
   ├── Speech-to-Text (Google SpeechRecognition)
   ├── Gemini API (LLM response generation)
   └── Text-to-Speech (Edge-TTS Neural Voice)
   │
   ▼
Frontend (Displays response + plays audio)
```

---

## ⚙️ Tech Stack  

### **Frontend**
- React.js  
- TailwindCSS  
- MediaRecorder API (voice recording)  
- Axios / Fetch  

### **Backend**
- Flask (Python)  
- SpeechRecognition (Google STT)  
- Pydub + FFmpeg (audio conversion)  
- Edge-TTS (Azure Neural Voice)  
- Gemini API (response generation)  

---

## 🔌 API Endpoints  

- `POST /handle` → Process text query → returns AI response  
- `POST /process_audio` → Process audio query → returns text + response + audio file URL  
- `POST /text_to_speech` → Convert text into mp3 (Ganesh Bappa voice)  
- `GET /get_audio/<filename>` → Retrieve generated audio file  

---

## 🖥 Local Development  

### 1️⃣ Clone the repository  
```bash
git clone https://github.com/your-username/ganesh-bappa-chatbot.git
cd ganesh-bappa-chatbot
```

### 2️⃣ Backend Setup  
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Backend runs at: `http://127.0.0.1:5000/`

### 3️⃣ Frontend Setup  
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: `http://localhost:3000/`

---

## 🌍 Deployment  

The app is deployed on **[Your Deployment Platform (e.g., Railway / Render / Vercel)]**.  
👉 Live Demo: [https://your-deployment-link.com](https://your-deployment-link.com)  

---

## 📸 Screenshots  

### 💬 Chat Interface
![Chat UI](./screenshots/chat-ui.png)

### 🎤 Voice Interaction
![Voice Recording](./screenshots/voice-ui.png)

---

## 🔮 Future Enhancements  
- Multi-language support (Hindi, Marathi, Sanskrit)  
- Real-time streaming responses (WebSockets)  
- Emotion-aware responses  
- Dockerized deployment  
- Database integration (chat history)  

---

## 🙏 Acknowledgements  
- [Flask](https://flask.palletsprojects.com/)  
- [React](https://reactjs.org/)  
- [TailwindCSS](https://tailwindcss.com/)  
- [Google SpeechRecognition](https://pypi.org/project/SpeechRecognition/)  
- [Azure Edge-TTS](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/)  
- [Gemini API](https://ai.google.dev/)  

---

## 📜 License  
This project is licensed under the **MIT License**.  
