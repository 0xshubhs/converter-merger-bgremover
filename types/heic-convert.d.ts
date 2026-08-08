declare module 'heic-convert' {
  const convert: (options: {
    buffer: Buffer;
    format: 'JPEG' | 'PNG';
    quality?: number;
  }) => Promise<Buffer>;

  export default convert;
}