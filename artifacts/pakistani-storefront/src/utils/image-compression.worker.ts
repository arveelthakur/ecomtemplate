type CompressionRequest = { file: File };
type CompressionResponse =
  | { type: 'progress'; percent: number }
  | { type: 'result'; blob: Blob }
  | { type: 'error'; message: string };

const send = (message: CompressionResponse) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<CompressionRequest>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    if (typeof createImageBitmap !== 'function') throw new Error('Image decoding is unavailable in the background.');
    if (typeof OffscreenCanvas === 'undefined') throw new Error('Background image conversion is unavailable in this browser.');
    send({ type: 'progress', percent: 5 });
    bitmap = await createImageBitmap(event.data.file);
    send({ type: 'progress', percent: 35 });
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot compress images in the background.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    send({ type: 'progress', percent: 60 });

    const encode = (type: string, quality: number) => canvas.convertToBlob({ type, quality });
    let quality = .86;
    let blob = await encode('image/webp', quality);
    if (blob.type !== 'image/webp') {
      const fallbackType = event.data.file.type === 'image/webp' ? 'image/jpeg' : event.data.file.type;
      blob = await encode(fallbackType, quality);
      if (blob.type !== fallbackType) throw new Error('This browser cannot encode the selected image format.');
    }
    send({ type: 'progress', percent: 80 });
    while (blob.size > 1536 * 1024 && quality > .72 && blob.type !== 'image/png') {
      quality -= .1;
      blob = await encode(blob.type, quality);
    }
    send({ type: 'progress', percent: 100 });
    send({ type: 'result', blob });
  } catch (error) {
    send({
      type: 'error',
      message: error instanceof Error ? error.message : 'Image compression failed.',
    });
  } finally {
    bitmap?.close();
  }
};
