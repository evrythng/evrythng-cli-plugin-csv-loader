const { expect } = require('chai');
const evrythng = require('evrythng');
const nock = require('nock');
const mapper = require('../src/modules/mapper');
const platform = require('../src/modules/platform');
const util = require('../src/modules/util');

const mockApi = () => nock('https://api.evrythng.com');

describe('csv-loader', () => {
  describe('util.js', () => {
    it('should validate against a schema', () => {
      const obj = {
        name: 'Test Object',
        tags: ['test'],
      };
      const schema = {
        additionalProperties: false,
        required: ['name', 'tags'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
            },
          },
        },
      };

      const attempt = () => util.validate(schema, obj, 'test object');
      expect(attempt).to.not.throw();
    });

    it('should not validate an incorrect object', () => {
      const obj = {
        name: 'Test Object',
        tags: [],
        brand: 'foo',
      };
      const schema = {
        additionalProperties: false,
        required: ['name', 'tags'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
            },
          },
        },
      };

      const attempt = () => util.validate(schema, obj, 'test object');

      expect(attempt).to.throw();
    });

    it('should update progress in console', () => {
      const attempt = () => util.updateProgress('test progress', 1, 10);

      expect(attempt).to.not.throw();
    });

    it('should load a JSON file', () => {
      const data = util.loadFile(`${__dirname}/test.json`);

      expect(data.some).to.equal('data');
    });

    it('should load a text file', () => {
      const text = util.loadFile(`${__dirname}/test.json`, false);

      expect(text).to.equal('{\n  "some": "data"\n}');
    });

    it('should remove duplicate keys', () => {
      const obj = {
        foo: 'bar',
        '\uFEFFfoo': 'bar',
      };
      const result = util.removeDuplicateKeys(obj);

      expect(result.foo).to.equal('bar');
      expect(Object.keys(result).length).to.equal(1);
    });

    it('should load CSV objects from text with schema', async () => {
      const input = `name,desc,date
object1,the first object,230819
object2,the second object,240819
object3,the third object,270819`;
      const schema = {
        additionalProperties: false,
        required: ['name', 'desc', 'date'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
          },
          desc: {
            type: 'string',
            minLength: 1,
          },
          date: {
            type: 'string',
            minLength: 6,
            maxLength: 6,
          },
        },
      };

      const output = await util.loadCsvRecords(input, schema);
      const expected = [
        { name: 'object1', desc: 'the first object', date: '230819' },
        { name: 'object2', desc: 'the second object', date: '240819' },
        { name: 'object3', desc: 'the third object', date: '270819' },
      ];
      expect(output).to.deep.equal(expected);
    });
  });

  describe('mapper.js', () => {
    it('should map an object to a resource', () => {
      const record = {
        Name: 'object1',
        Desc: 'the first object',
        Date: '230819',
        Batch: 'batch02',
      };
      const mapping = {
        Name: 'name',
        Desc: 'description',
        Date: 'customFields.date',
        Batch: 'tags[0]',
      };

      const resource = mapper.mapRecordToResource(record, mapping);
      const expected = {
        name: 'object1',
        description: 'the first object',
        customFields: {
          date: '230819',
        },
        tags: ['batch02'],
      };
      expect(resource).to.deep.equal(expected);
    });

    it('should throw if a key is not mapped', () => {
      const record = {
        Name: 'object1',
        Desc: 'the first object',
        Date: '230819',
        Batch: 'batch02',
      };
      const mapping = {
        Name: 'name',
        Desc: 'description',
        Date: 'customFields.date',
      };

      const attempt = () => mapper.mapRecordToResource(record, mapping);
      expect(attempt).to.throw();
    });

    it('should throw if a mapping contains too many full stops', () => {
      const record = {
        Name: 'object1',
      };
      const mapping = {
        Name: 'name.foo.bar',
      };

      const attempt = () => mapper.mapRecordToResource(record, mapping);
      expect(attempt).to.throw();
    });

    it('should throw if no name is produced', () => {
      const record = {
        Date: '230819',
      };
      const mapping = {
        Date: 'customFields.date',
      };

      const attempt = () => mapper.mapRecordToResource(record, mapping);
      expect(attempt).to.throw();
    });
  });

  describe('platform.js', () => {
    let operator;

    before(async () => {
      mockApi()
        .persist()
        .get('/access')
        .reply(200, {
          actor: { id: 'foo' },
        });

      operator = new evrythng.Operator('foo');
    });

    it('should load the project', async () => {
      mockApi()
        .get('/projects?filter=name%3Dfoo')
        .reply(200, [{ id: 'bar' }]);
      mockApi()
        .put('/projects/bar', { name: 'foo' })
        .reply(200, { id: 'bar', name: 'foo' });

      const config = {
        output: {
          projectName: 'foo',
        },
      };
      const res = await platform.loadProject(operator, config);
      expect(res.id).to.equal('bar');
    });

    it('should upsert a resource', async () => {
      mockApi()
        .get('/products?filter=name%3Dfoo')
        .reply(200, [{ id: 'bar', name: 'foo' }]);
      mockApi()
        .put('/products/bar', { name: 'foo' })
        .reply(200, { id: 'bar', name: 'foo' });
      mockApi()
        .put('/products/bar', {
          scopes: {
            projects: ['+foo'],
          },
        })
        .reply(200, [{ id: 'bar', name: 'foo' }]);

      const resource = { name: 'foo' };
      const config = {
        output: {
          updateKey: 'name',
          type: 'product',
        },
      };
      const project = { id: 'foo' };
      const outputSchema = {
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      };

      await platform.upsertResource(
        resource,
        config,
        operator,
        project,
        outputSchema
      );
    });

    it('should upsert all resources in a list', async () => {
      mockApi()
        .get('/products?filter=name%3Dfoo')
        .reply(200, [{ id: 'bar', name: 'foo' }]);
      mockApi()
        .put('/products/bar', { name: 'foo' })
        .reply(200, { id: 'bar', name: 'foo' });
      mockApi()
        .put('/products/bar', {
          scopes: {
            projects: ['+foo'],
          },
        })
        .reply(200, [{ id: 'bar', name: 'foo' }]);

      const resources = [{ name: 'foo' }];
      const config = {
        output: {
          updateKey: 'name',
          type: 'product',
        },
      };
      const project = { id: 'foo' };
      const outputSchema = {
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      };

      await platform.upsertAllResources(
        operator,
        config,
        resources,
        project,
        outputSchema
      );
    });

    it('should correctly handle an API error with p-retry', async () => {
      mockApi()
        .get('/products?filter=name%3Dfoo')
        .reply(200, []);
      mockApi()
        .post('/products', { name: 'foo' })
        .reply(400, { errors: ['Bad request!'] });

      const resource = { name: 'foo' };
      const config = {
        output: {
          updateKey: 'name',
          type: 'product',
        },
      };
      const project = { id: 'foo' };
      const outputSchema = {
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      };

      const attempt = () => platform.upsertResource(
        resource,
        config,
        operator,
        project,
        outputSchema
      );

      expect(attempt).to.not.throw();
    });

    it('should support config.output.defaultRedirectUrl', async () => {
      const defaultRedirectUrl = 'https://google.com?id={shortId}';

      mockApi()
        .get('/products?filter=name%3Dfoo')
        .reply(200, [{ id: 'bar', name: 'foo' }]);
      mockApi()
        .put('/products/bar', { name: 'foo' })
        .reply(200, { id: 'bar', name: 'foo' });
      mockApi()
        .put('/products/bar', {
          scopes: {
            projects: ['+foo'],
          },
        })
        .reply(200, [{ id: 'bar', name: 'foo' }]);
      mockApi()
        .post('/products/bar/redirector', { defaultRedirectUrl })
        .reply(201, {});

      const resource = { name: 'foo' };
      const config = {
        output: {
          updateKey: 'name',
          type: 'product',
          defaultRedirectUrl,
        },
      };
      const project = { id: 'foo' };
      const outputSchema = {
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      };

      await platform.upsertResource(
        resource,
        config,
        operator,
        project,
        outputSchema
      );
    });
  });
});
