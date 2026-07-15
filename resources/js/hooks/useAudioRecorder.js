import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Records a voice note from the microphone, for the mic button on the comment composer.
 *
 * The recording is handed back as a File, ready to go straight into a FormData — the server
 * takes whatever container the browser produced (Chrome gives WebM, Safari MP4).
 */
export function useAudioRecorder() {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState(null);

    const recorder = useRef(null);
    const chunks = useRef([]);
    const ticker = useRef(null);

    // The microphone stays open for as long as the recorder holds it, and a stream that
    // outlives its component leaves the browser's recording indicator on — so releasing every
    // track is not optional cleanup, it is the only thing that turns the mic light off.
    const releaseMicrophone = useCallback(() => {
        recorder.current?.stream.getTracks().forEach((track) => track.stop());
        recorder.current = null;

        clearInterval(ticker.current);
        ticker.current = null;
    }, []);

    // Unmounting mid-recording — closing the reply box, say — must not leave the mic live.
    useEffect(() => releaseMicrophone, [releaseMicrophone]);

    const start = useCallback(async () => {
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            chunks.current = [];
            recorder.current = new MediaRecorder(stream);

            recorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) chunks.current.push(event.data);
            };

            recorder.current.start();
            setSeconds(0);
            setRecording(true);

            ticker.current = setInterval(() => setSeconds((value) => value + 1), 1000);
        } catch {
            // Denying the permission prompt lands here, as does a machine with no microphone.
            setError('Microphone unavailable. Check the permission and try again.');
        }
    }, []);

    /**
     * Stop recording and resolve with the finished clip.
     *
     * @returns {Promise<File|null>} the recording, or null if nothing was captured.
     */
    const stop = useCallback(
        () =>
            new Promise((resolve) => {
                const active = recorder.current;

                if (!active || active.state === 'inactive') {
                    resolve(null);
                    return;
                }

                // The last chunk only arrives with `onstop`, so the File cannot be assembled
                // until the recorder says it is done.
                active.onstop = () => {
                    const type = active.mimeType || 'audio/webm';
                    const blob = new Blob(chunks.current, { type });

                    releaseMicrophone();
                    setRecording(false);

                    // The extension has to match the container the browser chose, since the
                    // server checks the filename against the sniffed content.
                    const extension = type.includes('mp4') ? 'mp4' : 'webm';

                    resolve(
                        blob.size > 0
                            ? new File([blob], `voice-note.${extension}`, { type })
                            : null
                    );
                };

                active.stop();
            }),
        [releaseMicrophone]
    );

    const cancel = useCallback(() => {
        const active = recorder.current;

        if (active && active.state !== 'inactive') {
            active.onstop = null;
            active.stop();
        }

        releaseMicrophone();
        setRecording(false);
        setSeconds(0);
    }, [releaseMicrophone]);

    return {
        recording,
        seconds,
        error,
        start,
        stop,
        cancel,
        supported: typeof MediaRecorder !== 'undefined',
    };
}
