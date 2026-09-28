// jsdom's Blob omits text()/arrayBuffer(), which browsers and Node provide; application code relies on them.
if (typeof Blob !== "undefined" && typeof FileReader !== "undefined") {
  const read = <T>(blob: Blob, method: "readAsText" | "readAsArrayBuffer") =>
    new Promise<T>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as T);
      reader.onerror = () => reject(reader.error);
      reader[method](blob);
    });
  if (typeof Blob.prototype.text !== "function") {
    Blob.prototype.text = function text(this: Blob) {
      return read<string>(this, "readAsText");
    };
  }
  if (typeof Blob.prototype.arrayBuffer !== "function") {
    Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
      return read<ArrayBuffer>(this, "readAsArrayBuffer");
    };
  }
}
