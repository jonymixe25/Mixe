import React, { useEffect, useRef } from "react";
import { Video, VideoOff, Mic, MicOff, Star } from "lucide-react";
import { motion } from "motion/react";

interface StreamPlayerCardProps {
  id: string;
  name: string;
  role: "host" | "guest" | "me";
  track?: any; // LiveKit Track
  mediaStream?: MediaStream | null; // standard HTML5 MediaStream (for host's own camera)
  isLocal?: boolean;
  scaleX?: boolean;
  fitMode?: "cover" | "contain";
  isTalking?: boolean;
}

export const StreamPlayerCard: React.FC<StreamPlayerCardProps> = ({
  id,
  name,
  role,
  track,
  mediaStream,
  isLocal = false,
  scaleX = false,
  fitMode = "cover",
  isTalking = false,
}) => {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let attachedElement: HTMLVideoElement | HTMLAudioElement | null = null;

    if (track) {
      // It's a LiveKit track
      const el = track.attach();
      if (el instanceof HTMLVideoElement) {
        el.className = "w-full h-full";
        el.playsInline = true;
        el.autoplay = true;
        el.muted = isLocal;
        el.style.objectFit = fitMode;
        if (scaleX) {
          el.style.transform = "scaleX(-1)";
        } else {
          el.style.transform = "none";
        }
        elementRef.current = el;
        
        if (videoContainerRef.current) {
          videoContainerRef.current.innerHTML = "";
          videoContainerRef.current.appendChild(el);
        }
        attachedElement = el;
      }
    } else if (mediaStream) {
      // It's a standard MediaStream
      const el = document.createElement("video");
      el.srcObject = mediaStream;
      el.playsInline = true;
      el.autoplay = true;
      el.muted = true; // Local previews are always muted to avoid microphonic feedback
      el.className = "w-full h-full";
      el.style.objectFit = fitMode;
      if (scaleX) {
        el.style.transform = "scaleX(-1)";
      } else {
        el.style.transform = "none";
      }

      el.onloadedmetadata = () => {
        el.play().catch((err) => {
          if (err.name !== "AbortError") {
            console.error("MediaStream video play failed:", err);
          }
        });
      };

      elementRef.current = el;
      
      if (videoContainerRef.current) {
        videoContainerRef.current.innerHTML = "";
        videoContainerRef.current.appendChild(el);
      }
      attachedElement = el;
    }

    return () => {
      if (track && attachedElement) {
        track.detach(attachedElement);
      }
      if (attachedElement && attachedElement.parentNode) {
        attachedElement.parentNode.removeChild(attachedElement);
      }
    };
  }, [track, mediaStream, isLocal, scaleX, fitMode]);

  useEffect(() => {
    // Dynamic update for object-fit / scale
    if (elementRef.current) {
      elementRef.current.style.objectFit = fitMode;
      if (scaleX) {
        elementRef.current.style.transform = "scaleX(-1)";
      } else {
        elementRef.current.style.transform = "none";
      }
    }
  }, [fitMode, scaleX]);

  const hasVideoSource = !!track || !!mediaStream;

  return (
    <div
      className={`relative flex-1 min-w-0 min-h-0 w-full h-full bg-zinc-950 rounded-2xl md:rounded-[2rem] overflow-hidden border transition-all duration-300 group/card ${
        isTalking
          ? "border-[#ff4e00] ring-4 ring-[#ff4e00]/20 shadow-[0_0_30px_rgba(255,78,0,0.25)]"
          : "border-white/10 hover:border-white/20 shadow-2xl"
      }`}
    >
      {/* Video Stream Element container */}
      <div
        ref={videoContainerRef}
        className={`w-full h-full transition-opacity duration-500 ${
          hasVideoSource ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Fallback Screen: When no track is active or video is off */}
      {!hasVideoSource && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#ff4e00]/15 to-violet-500/15 flex items-center justify-center border border-white/10 animate-pulse">
              <span className="text-xl font-bold text-white/70 uppercase">
                {name ? name.substring(0, 2) : "DU"}
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-zinc-950 p-1.5 rounded-full border border-white/10">
              <VideoOff className="w-3.5 h-3.5 text-white/40" />
            </div>
          </div>
          <span className="text-[11px] font-semibold text-white/50 tracking-wider uppercase">
            Cámara Inactiva
          </span>
          <span className="text-[10px] text-white/30 truncate mt-1 max-w-[150px]">
            {name}
          </span>
        </div>
      )}

      {/* Active Speaker Dynamic Edge Highlight */}
      {isTalking && (
        <div className="absolute inset-0 bg-transparent ring-1 ring-[#ff4e00]/40 rounded-2xl pointer-events-none z-15" />
      )}

      {/* Overlay details: Name and Badges */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none select-none">
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/15 pointer-events-auto shadow-lg shadow-black/40">
          
          {/* Sound pulse / talking wave animation */}
          <div className="flex items-end gap-[1.5px] h-3 w-3.5">
            <motion.div
              animate={isTalking ? { height: ["4px", "12px", "4px"] } : { height: "4px" }}
              transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
              className="w-[2px] bg-[#ff4e00] rounded-full"
            />
            <motion.div
              animate={isTalking ? { height: ["6px", "10px", "6px"] } : { height: "6px" }}
              transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut", delay: 0.1 }}
              className="w-[2px] bg-[#ff4e00] rounded-full"
            />
            <motion.div
              animate={isTalking ? { height: ["4px", "12px", "4px"] } : { height: "4px" }}
              transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut", delay: 0.2 }}
              className="w-[2px] bg-[#ff4e00] rounded-full"
            />
          </div>

          <span className="text-[10px] sm:text-[11px] font-bold text-white max-w-[100px] sm:max-w-[150px] truncate tracking-wide">
            {name}
          </span>

          {/* Styled Badge */}
          {role === "host" ? (
            <span className="flex items-center gap-1 text-[8px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              <Star className="w-2.5 h-2.5 fill-current" />
              ANFITRIÓN
            </span>
          ) : role === "guest" ? (
            <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-[#ff4e00]/10 text-brand border border-[#ff4e00]/25">
              INVITADO
            </span>
          ) : (
            <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-300 border border-zinc-500/20">
              TÚ
            </span>
          )}
        </div>

        {/* Quality indicator / overlay feedback */}
        {hasVideoSource && (
          <div className="hidden sm:flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-xl border border-white/5 text-[9px] font-mono font-medium text-white/50">
            <span>HD</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        )}
      </div>

      {/* Mic sound overlay */}
      <div className="absolute top-4 left-4 z-25 text-white bg-black/40 backdrop-blur-md p-1.5 rounded-lg border border-white/5 opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none">
        {isTalking ? (
          <Mic className="w-3.5 h-3.5 text-[#ff4e00]" />
        ) : (
          <Mic className="w-3.5 h-3.5 text-white/50" />
        )}
      </div>
    </div>
  );
};
