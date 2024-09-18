import React, { useRef, useState, useEffect } from "react";
import Peer from "simple-peer";
import io from "socket.io-client";
import "./styles/App.css";

const socket = io.connect("http://localhost:5001");

function App() {
  const [me, setMe] = useState("");
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState("");
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState("");
  const [callerName, setCallerName] = useState(""); // caller name
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [calling, setCalling] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  const callUser = (id) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
    });

    // enable call
    setCalling(true);

    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: me,
        name: name,
      });
    });

    peer.on("stream", (stream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
    });

    socket.on("callAccepted", (signal) => {
      setCallAccepted(true);
      // Cleat state after call
      setCalling(false);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: caller });
    });

    peer.on("stream", (stream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;

    setName("");
    setIdToCall("");
  };

  const leaveCall = () => {
    setCallEnded(true);

    // Stop media tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    // Close webrtc connection
    if (connectionRef.current) {
      connectionRef.current.destroy();
    }

    setCallAccepted(false);
    setCalling(false);
    setCallEnded(false);
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks()[0].enabled = !isVideoEnabled;
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = !isAudioEnabled;
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const copyClipboard = () => {
    navigator.clipboard
      .writeText(me)
      .then(() => setCopied(true))
      .finally(setTimeout(() => setCopied(false), 1000));
  };

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      setStream(stream);
      if (myVideo.current) {
        myVideo.current.srcObject = stream;
      }
    });

    socket.on("connect", () => {
      setMe(socket.id);
    });

    socket.on("receiveCall", ({ signal, from, name }) => {
      setReceivingCall(true);
      setCaller(from);
      setCallerSignal(signal);
      setCallerName(name);
    });
  }, []);

  return (
    <div className="App">
      <h1>{"WebRTC+Socket.io video call"}</h1>

      <div className="container">
        <div className="video-container">
          <div className="video">
            {stream && <video playsInline muted ref={myVideo} autoPlay />}
            <p className="person">{"Вы"}</p>
            {/* Надпись под видео пользователя */}
          </div>

          {callAccepted && !callEnded ? (
            <div className="video">
              <video playsInline ref={userVideo} autoPlay />

              <p className="person">{callerName}</p>
              {/* Отображение имени собеседника под видео */}
            </div>
          ) : null}
        </div>

        {receivingCall && !callAccepted ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div>
              <h1>{`${callerName} вызывает..`}</h1> {/* Имя звонящего */}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <button onClick={answerCall}>{"Ответить на звонок"}</button>

              {calling && !callAccepted && <button onClick={leaveCall}>{"Отменить вызов"}</button>}
            </div>
          </div>
        ) : null}

        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              borderRadius: 8,
              backgroundColor: "#f0f0f0",
            }}
          >
            <h2>{"Данные для вызова абонента"}</h2>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
              }}
            >
              <p>{`Ваш ID для вызова: ${me ? me : "Вызов..."}`}</p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <button onClick={copyClipboard} style={{ width: "7rem" }}>
                  {copied ? "Скопировано" : "Копировать ID"}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplate: "1fr / 1fr 2fr",
                gap: 20,
                justifyContent: "space-between",
              }}
            >
              <p>{"Ваше имя"}</p>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={"Представьтесь"} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplate: "1fr / 1fr 2fr",
                gap: 20,
                justifyContent: "space-between",
              }}
            >
              <p>{"ID абонента"}</p>

              <input
                type="text"
                value={idToCall}
                onChange={(e) => setIdToCall(e.target.value)}
                placeholder={"Введите ID абонента"}
              />
            </div>

            {name && idToCall ? (
              <button onClick={() => callUser(idToCall)}>{"Позвонить"}</button>
            ) : (
              <button disabled>{"Позвонить"}</button>
            )}
          </div>

          <div
            style={{
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              alignItems: "center",
              borderRadius: "0.5rem",
              backgroundColor: "#f0f0f0",
            }}
          >
            <h2>{"Управление вызовом"}</h2>

            {callAccepted && !callEnded ? <button onClick={leaveCall}>{"Завершить вызов"}</button> : null}

            {/* Кнопки для управления видео и аудио */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <button onClick={toggleVideo}>{isVideoEnabled ? "Выключить видео" : "Включить видео"}</button>

              <button onClick={toggleAudio}>{isAudioEnabled ? "Выключить звук" : "Включить звук"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
