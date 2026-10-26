declare module 'gifsicle-wasm-browser' {
  type GifsicleRunInput = {
    input: Array<{ file: File | Blob | ArrayBuffer; name: string }>;
    command: string[];
  };
  type Gifsicle = {
    run(options: GifsicleRunInput): Promise<File[]>;
  };
  const gifsicle: Gifsicle;
  export default gifsicle;
}
