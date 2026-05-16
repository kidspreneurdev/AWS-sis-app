-- Seed default catalog courses; skip any codes that already exist
insert into catalog (code, title, type, area, credits, lab) values
  -- Language Arts
  ('ELA9',   'English 9',               'STD', 'Language Arts',  1.00, false),
  ('ELA9H',  'English 9 Honors',        'HON', 'Language Arts',  1.00, false),
  ('ELA10',  'English 10',              'STD', 'Language Arts',  1.00, false),
  ('ELA10H', 'English 10 Honors',       'HON', 'Language Arts',  1.00, false),
  ('APLANG', 'AP Language & Comp',      'AP',  'Language Arts',  1.00, false),
  ('APLIT',  'AP Literature & Comp',    'AP',  'Language Arts',  1.00, false),
  ('ELA12',  'English 12 / Sr Seminar', 'STD', 'Language Arts',  1.00, false),
  -- Mathematics
  ('ALG1',   'Algebra I',               'STD', 'Mathematics',    1.00, false),
  ('GEOM',   'Geometry',                'STD', 'Mathematics',    1.00, false),
  ('ALG2',   'Algebra II',              'STD', 'Mathematics',    1.00, false),
  ('PREC',   'Pre-Calculus',            'STD', 'Mathematics',    1.00, false),
  ('APCALC', 'AP Calculus AB',          'AP',  'Mathematics',    1.00, false),
  ('APSTAT', 'AP Statistics',           'AP',  'Mathematics',    1.00, false),
  -- Science
  ('BIO',    'Biology (Lab)',            'STD', 'Science',        1.00, true),
  ('CHEM',   'Chemistry (Lab)',          'STD', 'Science',        1.00, true),
  ('PHYS',   'Physics (Lab)',            'STD', 'Science',        1.00, true),
  ('APBIO',  'AP Biology (Lab)',         'AP',  'Science',        1.00, true),
  ('APCHEM', 'AP Chemistry (Lab)',       'AP',  'Science',        1.00, true),
  -- Social Studies
  ('WHIST',  'World History',            'STD', 'Social Studies', 1.00, false),
  ('USHIST', 'US History',              'STD', 'Social Studies', 1.00, false),
  ('APUSH',  'AP US History',           'AP',  'Social Studies', 1.00, false),
  ('GOVT',   'Government & Economics',  'STD', 'Social Studies', 1.00, false),
  ('APGOV',  'AP Gov & Politics',       'AP',  'Social Studies', 1.00, false),
  ('PSYCH',  'AP Psychology',           'AP',  'Social Studies', 1.00, false),
  -- Fine Arts
  ('ART',    'Visual Arts',             'STD', 'Fine Arts',      1.00, false),
  ('MUSIC',  'Music',                   'STD', 'Fine Arts',      1.00, false),
  -- PE or Health
  ('PE1',    'Physical Education',      'STD', 'PE or Health',   1.00, false),
  ('HEALTH', 'Health',                  'STD', 'PE or Health',   0.50, false),
  -- World Language
  ('SPAN1',  'Spanish I',               'STD', 'World Language', 1.00, false),
  ('SPAN2',  'Spanish II',              'STD', 'World Language', 1.00, false),
  -- Technology
  ('CS1',    'Computer Science',        'STD', 'Technology',     1.00, false),
  ('APCS',   'AP Computer Science A',   'AP',  'Technology',     1.00, false)
on conflict (code) do nothing;
