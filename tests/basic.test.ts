/**
 * Basic test to verify Jest configuration is working
 */

describe('Basic Test Suite', () => {
  it('should run basic test', () => {
    expect(true).toBe(true);
  });

  it('should test basic arithmetic', () => {
    expect(1 + 1).toBe(2);
    expect(2 * 3).toBe(6);
  });

  it('should test string operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
    expect('world'.length).toBe(5);
  });

  it('should test array operations', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr.includes(2)).toBe(true);
    expect([...arr, 4]).toEqual([1, 2, 3, 4]);
  });

  it('should test object operations', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj.name).toBe('test');
    expect(Object.keys(obj)).toEqual(['name', 'value']);
  });

  it('should test async operations', async () => {
    const promise = Promise.resolve('resolved');
    await expect(promise).resolves.toBe('resolved');
  });

  it('should test error handling', () => {
    expect(() => {
      throw new Error('Test error');
    }).toThrow('Test error');
  });
});