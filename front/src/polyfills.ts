// Polyfill for Buffer in browser environment
// This is needed for @ton/core which uses Node.js Buffer API

if (typeof window !== 'undefined' && typeof (window as any).Buffer === 'undefined') {
  // Create a Buffer polyfill that's compatible with @ton/core
  const BufferPolyfill = function(this: any, data: any, encoding?: any) {
    if (!(this instanceof BufferPolyfill)) {
      return new (BufferPolyfill as any)(data, encoding);
    }
    
    let buffer: Uint8Array;
    
    if (typeof data === 'number') {
      buffer = new Uint8Array(data);
      if (encoding !== undefined && typeof encoding === 'number') {
        buffer.fill(encoding);
      }
    } else if (typeof data === 'string') {
      if (encoding === 'base64') {
        const binary = atob(data);
        buffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          buffer[i] = binary.charCodeAt(i);
        }
      } else if (encoding === 'hex') {
        const hex = data.replace(/^0x/, '');
        buffer = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          buffer[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
      } else {
        const encoder = new TextEncoder();
        buffer = encoder.encode(data);
      }
    } else if (Array.isArray(data)) {
      buffer = new Uint8Array(data);
    } else if (data instanceof ArrayBuffer) {
      buffer = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      buffer = new Uint8Array(data);
    } else {
      buffer = new Uint8Array(0);
    }
    
    // Store buffer as property
    Object.defineProperty(this, '_buffer', {
      value: buffer,
      writable: false,
      enumerable: false,
    });
    
    // Make it array-like
    Object.defineProperty(this, 'length', {
      get: () => buffer.length,
      enumerable: true,
    });
    
    // Proxy index access
    return new Proxy(this, {
      get(target, prop) {
        if (typeof prop === 'string') {
          const num = Number(prop);
          if (!isNaN(num) && num >= 0 && num < buffer.length) {
            return buffer[num];
          }
        }
        return (target as any)[prop];
      },
      set(target, prop, value) {
        if (typeof prop === 'string') {
          const num = Number(prop);
          if (!isNaN(num) && num >= 0 && num < buffer.length) {
            buffer[num] = value;
            return true;
          }
        }
        (target as any)[prop] = value;
        return true;
      },
    });
  } as any;

  // Static methods
  BufferPolyfill.from = function(data: any, encoding?: string): any {
    return new BufferPolyfill(data, encoding);
  };

  BufferPolyfill.alloc = function(size: number, fill?: number): any {
    return new BufferPolyfill(size, fill);
  };

  // Instance methods
  BufferPolyfill.prototype.toString = function(encoding: string = 'utf8'): string {
    const buffer = (this as any)._buffer as Uint8Array;
    if (encoding === 'base64') {
      const binary = String.fromCharCode(...buffer);
      return btoa(binary);
    } else if (encoding === 'hex') {
      return Array.from(buffer)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } else {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(buffer);
    }
  };

  BufferPolyfill.prototype.slice = function(start?: number, end?: number): any {
    const buffer = (this as any)._buffer as Uint8Array;
    return new BufferPolyfill(buffer.slice(start, end));
  };

  BufferPolyfill.prototype.fill = function(value: number): any {
    const buffer = (this as any)._buffer as Uint8Array;
    buffer.fill(value);
    return this;
  };

  // Make it iterable
  BufferPolyfill.prototype[Symbol.iterator] = function() {
    const buffer = (this as any)._buffer as Uint8Array;
    return buffer[Symbol.iterator]();
  };

  // Assign to global
  (window as any).Buffer = BufferPolyfill;
  (globalThis as any).Buffer = BufferPolyfill;
}

export {};
