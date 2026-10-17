/**
 * ZIP sin compresión (las fotos y videos ya vienen comprimidos), generado en streaming: solo hay un archivo en memoria a la vez.
 * Usa "data descriptor" para escribir el CRC y el tamaño después de los datos. Solo Web Streams: corre en Node y en Workers.
 * ponytail: sin ZIP64, así que el total debe ser menor de 4 GB; con más habría que añadir los campos zip64.
 */
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const MAX = 0xfffffff0;
const dos = (d: Date) => ({
  time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
  date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
});

export type ZipEntry = { name: string; data: () => Promise<Uint8Array> };

export function zipStream(entries: ZipEntry[], now = new Date()): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const { time, date } = dos(now);
  const central: Uint8Array[] = [];
  let offset = 0;
  let i = 0;
  const hdr = (size: number, write: (v: DataView) => void) => {
    const b = new Uint8Array(size);
    write(new DataView(b.buffer));
    return b;
  };
  return new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      if (i < entries.length) {
        const e = entries[i++];
        const name = enc.encode(e.name);
        const data = await e.data();
        const crc = crc32(data);
        const local = hdr(30 + name.length, (v) => {
          v.setUint32(0, 0x04034b50, true);
          v.setUint16(4, 20, true);
          v.setUint16(6, 0x0808, true); // bit 3: descriptor al final; bit 11: nombres UTF-8
          v.setUint16(10, time, true);
          v.setUint16(12, date, true);
          v.setUint16(26, name.length, true);
        });
        local.set(name, 30);
        const tail = hdr(16, (v) => {
          v.setUint32(0, 0x08074b50, true);
          v.setUint32(4, crc, true);
          v.setUint32(8, data.length, true);
          v.setUint32(12, data.length, true);
        });
        const entryOffset = offset;
        if (entryOffset > MAX || data.length > MAX) throw new Error("zip too large");
        const cd = hdr(46 + name.length, (v) => {
          v.setUint32(0, 0x02014b50, true);
          v.setUint16(4, 20, true);
          v.setUint16(6, 20, true);
          v.setUint16(8, 0x0808, true);
          v.setUint16(12, time, true);
          v.setUint16(14, date, true);
          v.setUint32(16, crc, true);
          v.setUint32(20, data.length, true);
          v.setUint32(24, data.length, true);
          v.setUint16(28, name.length, true);
          v.setUint32(42, entryOffset, true);
        });
        cd.set(name, 46);
        central.push(cd);
        offset += local.length + data.length + tail.length;
        ctrl.enqueue(local);
        ctrl.enqueue(data);
        ctrl.enqueue(tail);
        return;
      }
      const size = central.reduce((n, c) => n + c.length, 0);
      for (const c of central) ctrl.enqueue(c);
      ctrl.enqueue(
        hdr(22, (v) => {
          v.setUint32(0, 0x06054b50, true);
          v.setUint16(8, central.length, true);
          v.setUint16(10, central.length, true);
          v.setUint32(12, size, true);
          v.setUint32(16, offset, true);
        }),
      );
      ctrl.close();
    },
  });
}
