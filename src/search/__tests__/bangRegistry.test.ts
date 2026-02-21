import { describe, it, expect } from 'vitest';
import {
  resolveBang,
  resolveCommand,
  resolveSort,
  getAllBangNames,
  getAllCommandNames,
  BANG_REGISTRY,
  COMMAND_REGISTRY,
  SORT_OPTIONS,
  CHROME_GROUP_COLORS,
} from '../bangRegistry';

describe('resolveBang', () => {
  describe('full bang names', () => {
    it('resolves title', () => {
      expect(resolveBang('title')).toBe('title');
    });

    it('resolves url', () => {
      expect(resolveBang('url')).toBe('url');
    });

    it('resolves frozen', () => {
      expect(resolveBang('frozen')).toBe('frozen');
    });

    it('resolves audio', () => {
      expect(resolveBang('audio')).toBe('audio');
    });

    it('resolves pin', () => {
      expect(resolveBang('pin')).toBe('pin');
    });

    it('resolves vault', () => {
      expect(resolveBang('vault')).toBe('vault');
    });

    it('resolves grouped', () => {
      expect(resolveBang('grouped')).toBe('grouped');
    });

    it('resolves solo', () => {
      expect(resolveBang('solo')).toBe('solo');
    });

    it('resolves duplicate', () => {
      expect(resolveBang('duplicate')).toBe('duplicate');
    });

    it('resolves local', () => {
      expect(resolveBang('local')).toBe('local');
    });

    it('resolves ip', () => {
      expect(resolveBang('ip')).toBe('ip');
    });

    it('resolves browser', () => {
      expect(resolveBang('browser')).toBe('browser');
    });

    it('resolves groupname', () => {
      expect(resolveBang('groupname')).toBe('groupname');
    });

    it('resolves groupcolor', () => {
      expect(resolveBang('groupcolor')).toBe('groupcolor');
    });
  });

  describe('short aliases', () => {
    it('resolves t -> title', () => {
      expect(resolveBang('t')).toBe('title');
    });

    it('resolves u -> url', () => {
      expect(resolveBang('u')).toBe('url');
    });

    it('resolves f -> frozen', () => {
      expect(resolveBang('f')).toBe('frozen');
    });

    it('resolves a -> audio', () => {
      expect(resolveBang('a')).toBe('audio');
    });

    it('resolves p -> pin', () => {
      expect(resolveBang('p')).toBe('pin');
    });

    it('resolves v -> vault', () => {
      expect(resolveBang('v')).toBe('vault');
    });

    it('resolves g -> grouped', () => {
      expect(resolveBang('g')).toBe('grouped');
    });

    it('resolves s -> solo', () => {
      expect(resolveBang('s')).toBe('solo');
    });

    it('resolves d -> duplicate', () => {
      expect(resolveBang('d')).toBe('duplicate');
    });

    it('resolves l -> local', () => {
      expect(resolveBang('l')).toBe('local');
    });

    it('resolves i -> ip', () => {
      expect(resolveBang('i')).toBe('ip');
    });

    it('resolves b -> browser', () => {
      expect(resolveBang('b')).toBe('browser');
    });

    it('resolves gn -> groupname', () => {
      expect(resolveBang('gn')).toBe('groupname');
    });

    it('resolves gc -> groupcolor', () => {
      expect(resolveBang('gc')).toBe('groupcolor');
    });
  });

  describe('case insensitivity', () => {
    it('resolves uppercase full name', () => {
      expect(resolveBang('AUDIO')).toBe('audio');
      expect(resolveBang('FROZEN')).toBe('frozen');
    });

    it('resolves uppercase short alias', () => {
      expect(resolveBang('A')).toBe('audio');
      expect(resolveBang('F')).toBe('frozen');
    });

    it('resolves mixed case', () => {
      expect(resolveBang('AuDiO')).toBe('audio');
      expect(resolveBang('GrOuPeD')).toBe('grouped');
    });
  });

  describe('unknown bangs', () => {
    it('returns null for unknown bang name', () => {
      expect(resolveBang('unknown')).toBe(null);
      expect(resolveBang('xyz')).toBe(null);
    });

    it('returns null for empty string', () => {
      expect(resolveBang('')).toBe(null);
    });
  });
});

describe('resolveCommand', () => {
  describe('full command names', () => {
    it('resolves delete', () => {
      expect(resolveCommand('delete')).toBe('delete');
    });

    it('resolves save', () => {
      expect(resolveCommand('save')).toBe('save');
    });

    it('resolves freeze', () => {
      expect(resolveCommand('freeze')).toBe('freeze');
    });
  });

  describe('short aliases', () => {
    it('resolves d -> delete', () => {
      expect(resolveCommand('d')).toBe('delete');
    });

    it('resolves s -> save', () => {
      expect(resolveCommand('s')).toBe('save');
    });

    it('resolves f -> freeze', () => {
      expect(resolveCommand('f')).toBe('freeze');
    });
  });

  describe('case insensitivity', () => {
    it('resolves uppercase full name', () => {
      expect(resolveCommand('DELETE')).toBe('delete');
      expect(resolveCommand('SAVE')).toBe('save');
    });

    it('resolves uppercase short alias', () => {
      expect(resolveCommand('D')).toBe('delete');
      expect(resolveCommand('S')).toBe('save');
    });
  });

  describe('unknown commands', () => {
    it('returns null for unknown command', () => {
      expect(resolveCommand('unknown')).toBe(null);
    });

    it('returns null for empty string', () => {
      expect(resolveCommand('')).toBe(null);
    });
  });
});

describe('resolveSort', () => {
  it('resolves index', () => {
    expect(resolveSort('index')).toBe('index');
  });

  it('resolves title', () => {
    expect(resolveSort('title')).toBe('title');
  });

  it('resolves url', () => {
    expect(resolveSort('url')).toBe('url');
  });

  it('is case insensitive', () => {
    expect(resolveSort('TITLE')).toBe('title');
    expect(resolveSort('Url')).toBe('url');
    expect(resolveSort('INDEX')).toBe('index');
  });

  it('returns null for unknown sort', () => {
    expect(resolveSort('unknown')).toBe(null);
    expect(resolveSort('alpha')).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(resolveSort('')).toBe(null);
  });
});

describe('getAllBangNames', () => {
  it('includes all full names', () => {
    const names = getAllBangNames();
    expect(names).toContain('title');
    expect(names).toContain('url');
    expect(names).toContain('frozen');
    expect(names).toContain('audio');
    expect(names).toContain('pin');
    expect(names).toContain('vault');
    expect(names).toContain('grouped');
    expect(names).toContain('solo');
    expect(names).toContain('duplicate');
    expect(names).toContain('local');
    expect(names).toContain('ip');
    expect(names).toContain('browser');
    expect(names).toContain('groupname');
    expect(names).toContain('groupcolor');
  });

  it('includes all short aliases', () => {
    const names = getAllBangNames();
    expect(names).toContain('t');
    expect(names).toContain('u');
    expect(names).toContain('f');
    expect(names).toContain('a');
    expect(names).toContain('p');
    expect(names).toContain('v');
    expect(names).toContain('g');
    expect(names).toContain('s');
    expect(names).toContain('d');
    expect(names).toContain('l');
    expect(names).toContain('i');
    expect(names).toContain('b');
    expect(names).toContain('gn');
    expect(names).toContain('gc');
  });

  it('returns unique values', () => {
    const names = getAllBangNames();
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });
});

describe('getAllCommandNames', () => {
  it('includes all full names', () => {
    const names = getAllCommandNames();
    expect(names).toContain('delete');
    expect(names).toContain('save');
    expect(names).toContain('freeze');
  });

  it('includes all short aliases', () => {
    const names = getAllCommandNames();
    expect(names).toContain('d');
    expect(names).toContain('s');
    expect(names).toContain('f');
  });

  it('returns unique values', () => {
    const names = getAllCommandNames();
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });
});

describe('BANG_REGISTRY', () => {
  it('has all required bangs', () => {
    const expectedBangs = [
      'title', 'url', 'frozen', 'audio', 'pin', 'vault',
      'grouped', 'solo', 'duplicate', 'local', 'ip', 'browser',
      'groupname', 'groupcolor',
    ];
    
    for (const bang of expectedBangs) {
      expect(BANG_REGISTRY).toHaveProperty(bang);
    }
  });

  it('has correct structure for each bang', () => {
    for (const [key, def] of Object.entries(BANG_REGISTRY)) {
      expect(def).toHaveProperty('name');
      expect(def).toHaveProperty('description');
      expect(def).toHaveProperty('type');
      expect(['text-scope', 'boolean', 'value', 'sort']).toContain(def.type);
    }
  });
});

describe('COMMAND_REGISTRY', () => {
  it('has all required commands', () => {
    expect(COMMAND_REGISTRY).toHaveProperty('delete');
    expect(COMMAND_REGISTRY).toHaveProperty('save');
    expect(COMMAND_REGISTRY).toHaveProperty('freeze');
  });

  it('marks delete as destructive', () => {
    expect(COMMAND_REGISTRY.delete.destructive).toBe(true);
  });

  it('marks save and freeze as non-destructive', () => {
    expect(COMMAND_REGISTRY.save.destructive).toBe(false);
    expect(COMMAND_REGISTRY.freeze.destructive).toBe(false);
  });
});

describe('SORT_OPTIONS', () => {
  it('has all sort types', () => {
    expect(SORT_OPTIONS).toHaveProperty('index');
    expect(SORT_OPTIONS).toHaveProperty('title');
    expect(SORT_OPTIONS).toHaveProperty('url');
  });
});

describe('CHROME_GROUP_COLORS', () => {
  it('contains expected colors', () => {
    expect(CHROME_GROUP_COLORS).toContain('grey');
    expect(CHROME_GROUP_COLORS).toContain('blue');
    expect(CHROME_GROUP_COLORS).toContain('red');
    expect(CHROME_GROUP_COLORS).toContain('yellow');
    expect(CHROME_GROUP_COLORS).toContain('green');
    expect(CHROME_GROUP_COLORS).toContain('pink');
    expect(CHROME_GROUP_COLORS).toContain('purple');
    expect(CHROME_GROUP_COLORS).toContain('cyan');
    expect(CHROME_GROUP_COLORS).toContain('orange');
  });

  it('is readonly array', () => {
    expect(Array.isArray(CHROME_GROUP_COLORS)).toBe(true);
  });
});
