const MAX_IMAGE_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;
const VIDEO_MAX_BITRATE = 1_000_000;

export function canCompress(file: File): boolean {
  const isImage = file.type.startsWith("image/") && !file.type.includes("gif");
  const isVideo = file.type.startsWith("video/");
  return (isImage || isVideo) && file.size > 512 * 1024;
}

export async function compressFile(file: File): Promise<File> {
  if (file.type.startsWith("image/")) {
    return compressImage(file);
  }
  if (file.type.startsWith("video/")) {
    return compressVideo(file);
  }
  return file;
}

async function compressImage(file: File): Promise<File> {
  const img = await createImageBitmap(file);
  let { width, height } = img;
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  img.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );

  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
  });
}

async function compressVideo(file: File): Promise<File> {
  if (file.size <= 10 * 1024 * 1024) return file;
  if (!file.type.startsWith("video/")) return file;
  return file;
}
