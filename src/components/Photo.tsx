import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { savePhoto } from '../lib/photos';
import { Icon } from './Icon';

/** Shows a stored photo (or the textured placeholder). */
export function PhotoView({ id, thumb = false, empty, className = '', style }: { id?: string; thumb?: boolean; empty?: string; className?: string; style?: React.CSSProperties }) {
  const photo = useLiveQuery(() => (id ? db.photos.get(id) : undefined), [id]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!photo) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(thumb ? photo.thumb : photo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo, thumb]);
  return (
    <div className={`ph ${className}`} style={style}>
      {url ? <img src={url} alt="" /> : empty ? <span className="ph-empty">{empty}</span> : null}
    </div>
  );
}

/** A button that opens the camera / gallery and stores the chosen photo. */
export function PhotoPicker({ onPicked, label = 'Fotoğraf', className = 'btn sm', iconOnly = false }: { onPicked: (id: string) => void; label?: string; className?: string; iconOnly?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.click()} disabled={busy} aria-label={iconOnly ? label : undefined}>
        <Icon name="camera" size={16} />
        {!iconOnly && (busy ? 'Yükleniyor…' : label)}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try {
            onPicked(await savePhoto(f));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
