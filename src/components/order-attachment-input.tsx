import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Mic, Square, X, Play, Pause, Paperclip, FileText, Film, Music, File as FileIcon } from "lucide-react";

export type LocalAttachments = {
  images: File[];
  voice: Blob | null;
  files: File[];
};

function fileIcon(f: File) {
  const t = f.type;
  if (t.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (t.startsWith("video/")) return <Film className="h-4 w-4" />;
  if (t.startsWith("audio/") || /\.(opus|ogg|mp3|wav|m4a)$/i.test(f.name)) return <Music className="h-4 w-4" />;
  if (t === "application/pdf" || /\.pdf$/i.test(f.name)) return <FileText className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function OrderAttachmentInput({
  value,
  onChange,
}: {
  value: LocalAttachments;
  onChange: (v: LocalAttachments) => void;
}) {
  const imageFileRef = useRef<HTMLInputElement>(null);
  const anyFileRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!value.voice) { setVoiceUrl(null); return; }
    const u = URL.createObjectURL(value.voice);
    setVoiceUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [value.voice]);

  const addImages = (files: FileList | null) => {
    if (!files?.length) return;
    onChange({ ...value, images: [...value.images, ...Array.from(files)] });
  };

  const addAnyFiles = (files: FileList | null) => {
    if (!files?.length) return;
    onChange({ ...value, files: [...value.files, ...Array.from(files)] });
  };

  const removeImage = (i: number) => {
    onChange({ ...value, images: value.images.filter((_, idx) => idx !== i) });
  };

  const removeFile = (i: number) => {
    onChange({ ...value, files: value.files.filter((_, idx) => idx !== i) });
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        onChange({ ...value, voice: blob });
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (e) {
      console.error(e);
      alert("تعذّر الوصول إلى الميكروفون");
    }
  };

  const stopRec = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={() => imageFileRef.current?.click()}>
          <ImageIcon className="h-4 w-4 ml-1" />صور
        </Button>
        <input
          ref={imageFileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { addImages(e.target.files); e.target.value = ""; }}
        />

        {!recording ? (
          <Button type="button" variant="outline" size="sm" onClick={startRec}>
            <Mic className="h-4 w-4 ml-1" />تسجيل صوتي
          </Button>
        ) : (
          <Button type="button" variant="destructive" size="sm" onClick={stopRec}>
            <Square className="h-4 w-4 ml-1" />إيقاف ({fmt(elapsed)})
          </Button>
        )}

        <Button type="button" variant="outline" size="sm" onClick={() => anyFileRef.current?.click()}>
          <Paperclip className="h-4 w-4 ml-1" />استيراد من واتساب / ملفات
        </Button>
        <input
          ref={anyFileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { addAnyFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {value.images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.images.map((f, i) => (
            <div key={i} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 left-1 bg-background/80 rounded-full p-0.5"
                aria-label="إزالة"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {value.files.length > 0 && (
        <ul className="space-y-1">
          {value.files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs">
              <span className="text-muted-foreground">{fileIcon(f)}</span>
              <span className="flex-1 truncate" title={f.name}>{f.name}</span>
              <span className="text-muted-foreground shrink-0">{fmtSize(f.size)}</span>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6"
                onClick={() => removeFile(i)} aria-label="إزالة">
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {voiceUrl && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          <Button type="button" size="icon" variant="ghost" onClick={togglePlay} className="h-8 w-8">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <span className="text-xs text-muted-foreground flex-1">تسجيل صوتي</span>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
            onClick={() => onChange({ ...value, voice: null })}>
            <X className="h-4 w-4" />
          </Button>
          <audio
            ref={audioRef}
            src={voiceUrl}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
