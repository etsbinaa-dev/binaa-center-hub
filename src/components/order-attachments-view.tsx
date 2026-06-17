import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Film, Music, File as FileIcon, Download } from "lucide-react";

const BUCKET = "order-attachments";

async function sign(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

type GenericFile = { path: string; url: string; name: string };

function basename(path: string) {
  const last = path.split("/").pop() || path;
  return last.replace(/^file-\d+-/, "");
}

function kind(name: string) {
  const lower = name.toLowerCase();
  if (/\.(mp4|mov|webm|mkv|avi)$/.test(lower)) return "video" as const;
  if (/\.(opus|ogg|mp3|wav|m4a|aac|flac)$/.test(lower)) return "audio" as const;
  if (/\.pdf$/.test(lower)) return "pdf" as const;
  return "doc" as const;
}

function KindIcon({ name }: { name: string }) {
  const k = kind(name);
  if (k === "video") return <Film className="h-4 w-4" />;
  if (k === "audio") return <Music className="h-4 w-4" />;
  if (k === "pdf") return <FileText className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
}

export function OrderAttachmentsView({
  images,
  voice,
  files,
}: {
  images: string[] | null;
  voice: string | null;
  files?: string[] | null;
}) {
  const [imgs, setImgs] = useState<string[]>([]);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [extras, setExtras] = useState<GenericFile[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (images?.length) {
        const urls = await Promise.all(images.map(sign));
        if (!cancelled) setImgs(urls.filter(Boolean) as string[]);
      } else setImgs([]);
      if (voice) {
        const u = await sign(voice);
        if (!cancelled) setVoiceUrl(u);
      } else setVoiceUrl(null);
      if (files?.length) {
        const resolved = await Promise.all(
          files.map(async (p) => {
            const u = await sign(p);
            return u ? { path: p, url: u, name: basename(p) } : null;
          }),
        );
        if (!cancelled) setExtras(resolved.filter(Boolean) as GenericFile[]);
      } else setExtras([]);
    })();
    return () => { cancelled = true; };
  }, [images, voice, files]);

  if (!imgs.length && !voiceUrl && !extras.length) return null;

  return (
    <div className="space-y-2">
      {imgs.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {imgs.map((u, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(u)}
              className="aspect-square rounded-md overflow-hidden border bg-muted"
            >
              <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {voiceUrl && (
        <audio controls src={voiceUrl} className="w-full h-10" preload="none" />
      )}
      {extras.length > 0 && (
        <ul className="space-y-1">
          {extras.map((f, i) => {
            const k = kind(f.name);
            if (k === "video") {
              return (
                <li key={i} className="rounded-md border overflow-hidden bg-muted/40">
                  <video src={f.url} controls className="w-full max-h-64" preload="none" />
                  <div className="flex items-center gap-2 p-2 text-xs">
                    <KindIcon name={f.name} />
                    <span className="flex-1 truncate" title={f.name}>{f.name}</span>
                    <a href={f.url} download={f.name} className="text-muted-foreground hover:text-foreground"><Download className="h-3 w-3" /></a>
                  </div>
                </li>
              );
            }
            if (k === "audio") {
              return (
                <li key={i} className="rounded-md border bg-muted/40 p-2 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <KindIcon name={f.name} />
                    <span className="flex-1 truncate" title={f.name}>{f.name}</span>
                    <a href={f.url} download={f.name} className="text-muted-foreground hover:text-foreground"><Download className="h-3 w-3" /></a>
                  </div>
                  <audio controls src={f.url} className="w-full h-10" preload="none" />
                </li>
              );
            }
            return (
              <li key={i} className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs">
                <KindIcon name={f.name} />
                <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 truncate hover:underline" title={f.name}>{f.name}</a>
                <a href={f.url} download={f.name} className="text-muted-foreground hover:text-foreground"><Download className="h-3 w-3" /></a>
              </li>
            );
          })}
        </ul>
      )}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
