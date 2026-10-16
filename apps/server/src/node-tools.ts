import sharp from "sharp";

/** Miniatura 400x400 webp. Solo en Node: sharp no corre en Cloudflare Workers. */
export async function thumbnail(img: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await sharp(img).rotate().resize(400, 400, { fit: "cover" }).webp({ quality: 78 }).toBuffer());
}
