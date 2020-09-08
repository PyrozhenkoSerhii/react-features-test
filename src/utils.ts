export const downloadFile = (data: Blob, name: string): void => {
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.style.display = "none";

  const url = window.URL.createObjectURL(data);
  a.href = url;
  a.download = name;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const saveByteArray = (data: BlobPart[], name: string): void => {
  const blob = new Blob(data, { type: "octet/stream" });
  downloadFile(blob, name);
};

export const getFileName = (counter: number): string => `00${counter}`.slice(-3);
