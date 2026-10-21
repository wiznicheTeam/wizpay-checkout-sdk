import { describe, expect, it } from 'vitest';
import { AddressInput } from '../src/address.js';

/**
 * A street number is not an apartment number. The form used to put Google's
 * street_number ("788") into the field labelled for a unit, so a shopper with a
 * real apartment had nowhere to put it, and anyone typing manually was asked to
 * split their own address in a way no US checkout asks for.
 *
 * One line goes in, the way people write it. The split happens on the way out,
 * because the processor wants the house number apart from the street name.
 */
function fieldsFrom(values: Record<string, string>) {
  // A minimal stand-in for the mounted DOM: AddressInput only ever reads values
  // through querySelector, so a map is enough and keeps jsdom out of the deps.
  const root = {
    querySelector: (sel: string) => {
      const name = /\[data-wzp="(.+?)"\]/.exec(sel)?.[1] ?? '';
      return name in values ? { value: values[name] } : null;
    },
  } as unknown as HTMLElement;

  return new AddressInput(root, {} as never, () => {}).value();
}

describe('the street line is split for the processor, not for the shopper', () => {
  it('separates the house number from the street name', () => {
    const v = fieldsFrom({ street: '788 Mount Vernon Avenue', city: 'Columbus', postal: '43203' });

    expect(v.houseNumberOrName).toBe('788');
    expect(v.street).toBe('Mount Vernon Avenue');
  });

  it('keeps an apartment separate from the street number', () => {
    const v = fieldsFrom({ street: '788 Mount Vernon Avenue', apt: 'Apt 4B' });

    expect(v.houseNumberOrName).toBe('788 Apt 4B');
    expect(v.street).toBe('Mount Vernon Avenue');
  });

  it('carries an apartment even when the street has no number', () => {
    const v = fieldsFrom({ street: 'The Old Rectory', apt: 'Unit 2' });

    expect(v.street).toBe('The Old Rectory');
    expect(v.houseNumberOrName).toBe('Unit 2');
  });

  it('handles a hyphenated or lettered house number', () => {
    expect(fieldsFrom({ street: '12A Baker Street' }).houseNumberOrName).toBe('12A');
    expect(fieldsFrom({ street: '221-B Baker Street' }).houseNumberOrName).toBe('221-B');
  });

  it('leaves a street with no leading number intact', () => {
    const v = fieldsFrom({ street: 'Mount Vernon Avenue' });

    expect(v.street).toBe('Mount Vernon Avenue');
    expect(v.houseNumberOrName).toBe('');
  });

  it('defaults the country rather than sending an empty one', () => {
    expect(fieldsFrom({ street: '1 Main St' }).country).toBe('US');
  });
});
