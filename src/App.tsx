import * as React from "react";
/**
 * @types/recordrtc is broken, thus we use this lib without typing
 */
import * as RecordRTCPromisesHandler from "recordrtc";

import { Wrapper } from "./styled";
import { downloadFile, getFileName } from "./utils";

const { useEffect, useState, useRef } = React;
const { StereoAudioRecorder } = RecordRTCPromisesHandler;

let counter = 0;

export const App = (): JSX.Element => {
  const [stream, setStream] = useState<MediaStream>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const getAudioStream = async () => {
    setStream(await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    }));
  };

  useEffect(() => {
    getAudioStream();
  }, []);

  useEffect(() => {
    if (stream) {
      const recorder = new RecordRTCPromisesHandler(stream, {
        type: "audio/wav",
        recorderType: StereoAudioRecorder,
        timeSlice: 5000,
        ondataavailable: async (newBlob: Blob) => {
          counter += 1;
          downloadFile(newBlob, getFileName(counter));
        },
      });
      recorder.startRecording();
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <Wrapper>
      <audio ref={audioRef} controls autoPlay playsInline muted />
    </Wrapper>
  );
};
