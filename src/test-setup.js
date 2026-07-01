import '@testing-library/jest-dom';

// Make processPhoto (canvas re-encode) work in jsdom
HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,/9j/test';

class MockImage {
  set src(_) { Promise.resolve().then(() => this.onload?.()); }
  get naturalWidth() { return 100; }
  get naturalHeight() { return 100; }
}
global.Image = MockImage;
global.URL.createObjectURL = () => 'blob:mock';
global.URL.revokeObjectURL = () => {};
