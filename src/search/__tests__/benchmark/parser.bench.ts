import { bench, describe } from 'vitest';
import { tokenize, parseQuery } from '../../parser';

const SIMPLE_QUERY = 'youtube music';
const COMPLEX_QUERY = '!audio !frozen !grouped !pin !browser !local !ip !solo !duplicate !vault';
const TEXT_SCOPE_QUERY = '!t long title search text here !u https://example.com/path/to/resource/page';
const MIXED_QUERY = 'term1, term2 !audio /delete sort:title !gn work';
const LONG_QUERY_500 = 'term1 term2 term3 ' + Array(50).fill('!audio !frozen !grouped').join(' ');

describe('tokenize benchmarks', () => {
  bench('simple query', () => {
    tokenize(SIMPLE_QUERY);
  });

  bench('complex query (10 bangs)', () => {
    tokenize(COMPLEX_QUERY);
  });

  bench('text-scope bangs', () => {
    tokenize(TEXT_SCOPE_QUERY);
  });

  bench('mixed query', () => {
    tokenize(MIXED_QUERY);
  });

  bench('long query (500+ chars)', () => {
    tokenize(LONG_QUERY_500);
  });

  bench('empty query', () => {
    tokenize('');
  });

  bench('only whitespace', () => {
    tokenize('    ');
  });
});

describe('parseQuery benchmarks', () => {
  bench('simple query', () => {
    parseQuery(SIMPLE_QUERY);
  });

  bench('complex query', () => {
    parseQuery(COMPLEX_QUERY);
  });

  bench('text-scope bangs', () => {
    parseQuery(TEXT_SCOPE_QUERY);
  });

  bench('mixed query', () => {
    parseQuery(MIXED_QUERY);
  });

  bench('long query', () => {
    parseQuery(LONG_QUERY_500);
  });

  bench('empty query', () => {
    parseQuery('');
  });

  bench('multiple comma-separated terms', () => {
    parseQuery('term1, term2, term3, term4, term5, term6, term7, term8, term9, term10');
  });

  bench('multiple commands', () => {
    parseQuery('/delete /save /freeze');
  });
});

describe('parseQuery (includes internal tokenization)', () => {
  bench('simple query', () => {
    parseQuery(SIMPLE_QUERY);
  });

  bench('complex query', () => {
    parseQuery(COMPLEX_QUERY);
  });

  bench('mixed query', () => {
    parseQuery(MIXED_QUERY);
  });
});
