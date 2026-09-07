import { Avatar as DiceBearAvatar, Style } from "@dicebear/core";
import voxelArt from "@dicebear/styles/voxel-art.json" with { type: "json" };
import { cn } from "@/shared/ui/cn";

/** Playful multi-hue background set (DiceBear's own recommended palette) so anonymous avatars read as colorful, distinct characters rather than a muted, samey wash. */
const BACKGROUND_COLORS = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"];

const SIZES = {
  sm: "size-9",
  md: "size-11",
  lg: "size-16",
};

const voxelArtStyle = new Style(voxelArt);

export function Avatar({
  seed,
  size = "md",
  className,
}: {
  /** Stable identifier the avatar's character/colors are derived from — the same seed always yields the same image. */
  seed: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const svg = new DiceBearAvatar(voxelArtStyle, {
    seed,
    backgroundColor: BACKGROUND_COLORS,
    // Close Up preset: voxel-art is a full-body figure; at avatar sizes the identity is in the face.
    scale: 1.25,
  }).toString();

  return (
    <div
      className={cn("shrink-0 overflow-hidden rounded-full [&>svg]:block [&>svg]:size-full", SIZES[size], className)}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
