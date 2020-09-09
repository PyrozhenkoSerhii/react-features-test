export const float32Concat = (first: Float32Array, second: Float32Array): Float32Array => {
  const firstLength = first.length;
  const result = new Float32Array(firstLength + second.length);

  result.set(first);
  result.set(second, firstLength);

  return result;
};
