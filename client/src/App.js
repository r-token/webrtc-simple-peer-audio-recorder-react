import React, { useEffect, useState, useRef } from 'react';
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Button from "react-bootstrap/Button";
import Spinner from 'react-bootstrap/Spinner'
import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";
import './App.css'

const Video = styled.video`
  border: 1px solid grey;
  borderRadius: 50%;
  width: 40%;
  height: 40%;
`;

function App() {
  const [yourID, setYourID] = useState("");
  const [users, setUsers] = useState({});
  const [stream, setStream] = useState();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [isRecording, setIsRecording] = useState(false)

  const userMedia = useRef();
  const partnerMedia = useRef();
  const socket = useRef();

  let mediaConstraints = {
    audio: true,
    video: true
  }

  useEffect(() => {
    socket.current = io.connect("/");

    navigator.mediaDevices.getUserMedia(mediaConstraints).then(stream => {
      setStream(stream);
      if (userMedia.current) {
        userMedia.current.srcObject = stream;
      }
    })

    navigator.mediaDevices.enumerateDevices().then(devices => {
      devices.forEach(device => {
        console.log(device.kind.toUpperCase(), device.label)
      })
    })

    socket.current.on("yourID", (id) => {
      setYourID(id);
    })
    socket.current.on("allUsers", (users) => {
      setUsers(users);
    })

    socket.current.on("hey", (data) => {
      setReceivingCall(true)
      setCaller(data.from)
      setCallerSignal(data.signal)
    })
  }, []);

  // Event Listeners for Savings/Recording Audio
  let start = document.getElementById('startButton')
  let stop = document.getElementById('stopButton')
  let audioPlayback = document.getElementById('audioPlayback')
  let mediaRecorder
  
  if (stream) {
    mediaRecorder = new MediaRecorder(stream)
    let chunks = []

    start.addEventListener('click', (event) => {
      console.log('start clicked')
      mediaRecorder.start()
      setIsRecording(true)
      console.log(mediaRecorder.state)
    })

    stop.addEventListener('click', (event) => {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
        setIsRecording(false)
        console.log(mediaRecorder.state)
      }
    })

    mediaRecorder.ondataavailable = function(event) {
      chunks.push(event.data)
    }

    mediaRecorder.onstop = () => {
      let blob = new Blob(chunks, {
        'type': 'audio/mpeg'
      })
      chunks = []
      let audioURL = window.URL.createObjectURL(blob)
      audioPlayback.src = audioURL
    }
  } else {
    console.log('undefined stream')
  }

  function callPeer(id) {
    const peer = new Peer({
      initiator: true,
      trickle: false, //trickle ICE??
      stream: stream
    })

    peer.on('signal', data => {
        socket.current.emit('callUser', { userToCall: id, signalData: data, from: yourID })
    })

    peer.on('stream', stream => {
      if (partnerMedia.current) {
        partnerMedia.current.srcObject = stream
      }
    })

    socket.current.on('callAccepted', signal => {
      setCallAccepted(true)
      peer.signal(signal)
    })
  }

  function acceptCall() {
    setCallAccepted(true)
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream
    })

    peer.on('signal', data => {
      socket.current.emit('acceptCall', { signal: data, to: caller })
    })

    peer.on('stream', stream => {
      partnerMedia.current.srcObject = stream
    })

    peer.signal(callerSignal)
  }

  let UserMedia;
  if (stream) {
    UserMedia = (
      <Video playsInline muted ref={userMedia} autoPlay />
    );
  }

  let PartnerMedia
  if (callAccepted) {
    PartnerMedia = (
      <Video playsInline ref={partnerMedia} autoPlay />
    );
  }

  function Recording() {
    if (isRecording) {
      return (
        <div className="center">
          <Spinner style={{marginBottom: "20px"}} animation="grow" variant="danger" size="lg">
            <span className="sr-only">Recording...</span>
          </Spinner>
        </div>
      )
    } else {
      return <p></p>
    }
  }

  let incomingCall;
  if (receivingCall) {
    incomingCall = (
      <div style={{marginTop: "20px"}}>
        <h3>{caller} is calling you</h3>
        <div className="center">
          <Button variant="success" onClick={acceptCall}>Answer Call</Button>
        </div>
      </div>
    )
  }

  return (
    <Container>
      <Row className="center" style={{marginBottom: "20px"}}>
        {UserMedia}
        {PartnerMedia}
      </Row>

      <Row className="center">
        {Object.keys(users).map(key => {
          if (key === yourID) {
            return null;
          }
          return (
            <Button variant="info" onClick={() => callPeer(key)}>Call {key}</Button>
          );
        })}
      </Row>
      <Row className="center">
        {incomingCall}
      </Row>

      <br />

      <span className="center">
        <Button variant="warning" style={{marginRight: "10px"}} id="startButton">Start Recording</Button>
        <Button variant="danger" id="stopButton">Stop Recording</Button>
      </span>
      <br />
      <Recording />
      <div className="center">
        <audio id="audioPlayback" controls preload="auto"></audio>
      </div>
    </Container>
  );
}

export default App;
