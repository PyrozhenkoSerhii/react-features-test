import * as React from "react";
/**
 * @types/recordrtc is broken, thus we use this lib without typing
 */
import * as RecordRTCPromisesHandler from "recordrtc";

import { Wrapper } from "./styled";
import { getFileName, saveByteArray } from "./utils";

const { useEffect, useState, useRef } = React;
const { StereoAudioRecorder } = RecordRTCPromisesHandler;

let counter = 0;
let read = 0;

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
        ondataavailable: () => {
          const internalRecorder = recorder.getInternalRecorder();
          const { leftchannel } = internalRecorder;

          const readItems = read ? leftchannel.slice(read) : leftchannel;

          const readItemsCount = Object.keys(readItems).length;
          read += readItemsCount;

          saveByteArray(readItems, getFileName(++counter));
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
