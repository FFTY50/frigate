import { baseUrl } from "@/api/baseUrl";
import { cn } from "@/lib/utils";
import { PlayerStatsType } from "@/types/live";
// @ts-expect-error we know this doesn't have types
import JSMpeg from "@cycjimmy/jsmpeg-player";
import React, { useEffect, useMemo, useRef, useState } from "react";

type JSMpegPlayerProps = {
  className?: string;
  camera: string;
  width: number;
  height: number;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  playbackEnabled: boolean;
  useWebGL: boolean;
  setStats?: (stats: PlayerStatsType) => void;
  onPlaying?: () => void;
};

export default function JSMpegPlayer({
  camera,
  width,
  height,
  className,
  containerRef,
  playbackEnabled,
  useWebGL = false,
  setStats,
  onPlaying,
}: JSMpegPlayerProps) {
  const url = `${baseUrl.replace(/^http/, "ws")}live/jsmpeg/${camera}`;
  const videoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const onPlayingRef = useRef(onPlaying);
  const [showCanvas, setShowCanvas] = useState(false);
  const [hasData, setHasData] = useState(false);
  const hasDataRef = useRef(hasData);
  const [dimensionsReady, setDimensionsReady] = useState(false);
  const bytesReceivedRef = useRef(0);
  const lastTimestampRef = useRef(Date.now());
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const selectedContainerRef = useMemo(
    () => (containerRef.current ? containerRef : internalContainerRef),
    // we know that these deps are correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [containerRef, containerRef.current, internalContainerRef],
  );

  useEffect(() => {
    if (selectedContainerRef.current && width && height) {
      setDimensionsReady(true);
    }
  }, [height, selectedContainerRef, width]);

  useEffect(() => {
    onPlayingRef.current = onPlaying;
  }, [onPlaying]);

  useEffect(() => {
    if (!selectedContainerRef?.current || !url) {
      return;
    }

    const videoWrapper = videoRef.current;
    const canvas = canvasRef.current;
    let videoElement: JSMpeg.VideoElement | null = null;

    let frameCount = 0;

    setHasData(false);

    if (videoWrapper && playbackEnabled) {
      // Delayed init to avoid issues with react strict mode
      const initPlayer = setTimeout(() => {
        videoElement = new JSMpeg.VideoElement(
          videoWrapper,
          url,
          { canvas: canvas },
          {
            protocols: [],
            audio: false,
            disableGl: !useWebGL,
            disableWebAssembly: !useWebGL,
            videoBufferSize: 1024 * 1024 * 4,
            onVideoDecode: () => {
              if (!hasDataRef.current) {
                setHasData(true);
                onPlayingRef.current?.();
              }
              frameCount++;
            },
          },
        );

        // Set up WebSocket message handler
        if (
          videoElement.player &&
          videoElement.player.source &&
          videoElement.player.source.socket
        ) {
          const socket = videoElement.player.source.socket;
          socket.addEventListener("message", (event: MessageEvent) => {
            if (event.data instanceof ArrayBuffer) {
              bytesReceivedRef.current += event.data.byteLength;
            }
          });
        }

        // Update stats every second
        statsIntervalRef.current = setInterval(() => {
          const currentTimestamp = Date.now();
          const timeDiff = (currentTimestamp - lastTimestampRef.current) / 1000; // in seconds
          const bitrate = bytesReceivedRef.current / timeDiff / 1000; // in kBps

          setStats?.({
            streamType: "jsmpeg",
            bandwidth: Math.round(bitrate),
            totalFrames: frameCount,
            latency: undefined,
            droppedFrames: undefined,
            decodedFrames: undefined,
            droppedFrameRate: undefined,
          });

          bytesReceivedRef.current = 0;
          lastTimestampRef.current = currentTimestamp;
        }, 1000);

        return () => {
          if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
            frameCount = 0;
            statsIntervalRef.current = null;
          }
        };
      }, 0);

      return () => {
        clearTimeout(initPlayer);
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
          statsIntervalRef.current = null;
        }
        if (videoElement) {
          try {
            // this causes issues in react strict mode
            // https://stackoverflow.com/questions/76822128/issue-with-cycjimmy-jsmpeg-player-in-react-18-cannot-read-properties-of-null-o
            videoElement.destroy();
            // eslint-disable-next-line no-empty
          } catch (e) {}
        }
      };
    }
    // we know that these deps are correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackEnabled, url]);

  useEffect(() => {
    setShowCanvas(hasData && dimensionsReady);
  }, [hasData, dimensionsReady]);

  useEffect(() => {
    hasDataRef.current = hasData;
  }, [hasData]);

  return (
    <div className={cn(className, !containerRef.current && "size-full")}>
      <div
        className="internal-jsmpeg-container size-full"
        ref={internalContainerRef}
      >
        <div
          ref={videoRef}
          className={cn(
            "jsmpeg flex size-full items-center justify-center",
            !showCanvas && "hidden",
          )}
        >
          <canvas
            ref={canvasRef}
            className="size-full rounded-lg md:rounded-2xl"
          ></canvas>
        </div>
      </div>
    </div>
  );
}
