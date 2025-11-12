import { YAMLObservationParser } from './YAMLObservationParser.js';

describe('YAMLObservationParser', () => {
  let parser: YAMLObservationParser;

  beforeEach(() => {
    parser = new YAMLObservationParser();
  });

  describe('parseObservation', () => {
    it('should parse "X is Y" pattern', () => {
      const obs = 'Structure is tetrameric';
      const props = parser.parseObservation(obs);

      expect(props).toHaveLength(1);
      expect(props[0].path.category).toBe('structure');
      expect(props[0].value).toBe('tetrameric');
      expect(props[0].confidence).toBe(0.9);
    });

    it('should parse "Property: value unit" pattern', () => {
      const obs = 'Conductance: 50 pS';
      const props = parser.parseObservation(obs);

      expect(props.length).toBeGreaterThanOrEqual(1);
      const conductanceProp = props.find(p => p.path.property === 'conductance');
      expect(conductanceProp).toBeDefined();
      expect(conductanceProp!.path.category).toBe('biophysics');
      expect(conductanceProp!.value).toEqual({ value: '50', unit: 'pS' });
      expect(conductanceProp!.confidence).toBe(1.0);
    });

    it('should parse multiple properties from comma-separated observation', () => {
      const obs = 'Blood pressure: 145/92 mmHg, Heart rate: 88 bpm';
      const props = parser.parseObservation(obs);

      expect(props.length).toBeGreaterThanOrEqual(2);

      const bpProp = props.find(p => p.path.property === 'blood_pressure');
      const hrProp = props.find(p => p.path.property === 'heart_rate');

      expect(bpProp).toBeDefined();
      expect(bpProp!.value).toEqual({ value: '145/92', unit: 'mmHg' });

      expect(hrProp).toBeDefined();
      expect(hrProp!.value).toEqual({ value: '88', unit: 'bpm' });
    });

    it('should parse "Requires X and Y" pattern', () => {
      const obs = 'Requires glutamate and glycine for activation';
      const props = parser.parseObservation(obs);

      expect(props).toHaveLength(1);
      expect(props[0].path.category).toBe('activation');
      expect(props[0].path.property).toBe('required_ligands');
      expect(props[0].value).toEqual(['glutamate', 'glycine']);
      expect(props[0].wikilinks).toEqual(['[[glutamate]]', '[[glycine]]']);
    });

    it('should parse "Blocked by X at Y" pattern', () => {
      const obs = 'Blocked by magnesium at -70 mV';
      const props = parser.parseObservation(obs);

      expect(props).toHaveLength(1);
      expect(props[0].path.category).toBe('biophysics');
      expect(props[0].path.subcategory).toBe('block');
      expect(props[0].value.agent).toBe('[[magnesium]]');
      expect(props[0].wikilinks).toContain('[[magnesium]]');
    });

    it('should parse "Composed of X and Y" pattern', () => {
      const obs = 'Composed of GluN1 and GluN2 subunits';
      const props = parser.parseObservation(obs);

      expect(props).toHaveLength(1);
      expect(props[0].path.category).toBe('structure');
      expect(props[0].path.property).toBe('components');
      expect(props[0].value).toEqual(['GluN1', 'GluN2 subunits']);
      expect(props[0].wikilinks).toEqual(['[[GluN1]]', '[[GluN2 subunits]]']);
    });
  });

  describe('buildYAMLStructure', () => {
    it('should build nested YAML structure', () => {
      const props = [
        {
          path: { category: 'structure', property: 'quaternary' },
          value: 'tetrameric',
          wikilinks: [],
          confidence: 0.9,
          sourceText: 'Structure is tetrameric'
        },
        {
          path: { category: 'biophysics', property: 'conductance' },
          value: { value: 50, unit: 'pS' },
          wikilinks: [],
          confidence: 1.0,
          sourceText: 'Conductance: 50 pS'
        }
      ];

      const yaml = parser.buildYAMLStructure(props);

      expect(yaml).toEqual({
        structure: {
          quaternary: 'tetrameric'
        },
        biophysics: {
          conductance: { value: 50, unit: 'pS' }
        }
      });
    });

    it('should handle subcategories', () => {
      const props = [
        {
          path: { category: 'biophysics', subcategory: 'block', property: 'agent' },
          value: '[[magnesium]]',
          wikilinks: ['[[magnesium]]'],
          confidence: 0.8,
          sourceText: 'Blocked by magnesium'
        }
      ];

      const yaml = parser.buildYAMLStructure(props);

      expect(yaml).toEqual({
        biophysics: {
          block: {
            agent: '[[magnesium]]'
          }
        }
      });
    });
  });

  describe('extractAllWikilinks', () => {
    it('should extract all unique wikilinks from properties', () => {
      const props = [
        {
          path: { category: 'activation', property: 'ligands' },
          value: [],
          wikilinks: ['[[glutamate]]', '[[glycine]]'],
          confidence: 0.85,
          sourceText: ''
        },
        {
          path: { category: 'structure', property: 'components' },
          value: [],
          wikilinks: ['[[GluN1]]', '[[GluN2]]'],
          confidence: 0.85,
          sourceText: ''
        }
      ];

      const wikilinks = parser.extractAllWikilinks(props);

      expect(wikilinks).toHaveLength(4);
      expect(wikilinks).toContain('glutamate');
      expect(wikilinks).toContain('glycine');
      expect(wikilinks).toContain('GluN1');
      expect(wikilinks).toContain('GluN2');
    });
  });
});
