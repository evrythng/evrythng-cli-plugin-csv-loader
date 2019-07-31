# pmd-loader

A generic configurable CSV => EVRYTHNG resource loading script. Input and output
validation with JSONSchema is performed, upsert by nominated key to EVRYTHNG is
done with a retry mechanism.


## Setup

1. `npm i`
2. `export OPERATOR_API_KEY=...` with the account Operator API Key.
3. Create a directory for the client/project and proceed to _Configuration_.


## Configuration

A configuration file is used to specify all other relevant files. Strict schemas
and exhaustive mapping can help ensure data integrity.

* `input`
  * `data` - Input data CSV file.
  * `schema` - JSONSchema for CSV records after they are read.
* `output`
  * `type` - Type of EVRYTHNG resource to create.
  * `projectName` - Name of the EVRYTHNG project to use.
  * `schema` - JSONSchema for each processed EVRYTHNG resource before it is
    created.
  * `updateKey` - Either `name` or some `identifiers` key to be used for
    updates.
  * `mapping` - JSON file that maps CSV column headers to EVRYTHNG resource
    fild names. Custom fields and identifiers are also supported with dot
    notation.
* `statsFile` - Path to a file to write stats and errors.


An example configuration is shown below:

```json
{
  "input": {
    "data": "./example/shoe-data.csv",
    "schema": "./example/input.schema.json"
  },
  "output": {
    "type": "product",
    "projectName": "Example PoC",
    "schema": "./example/output.schema.json",
    "updateKey": "gs1:01",
    "mapping": "./example/mapping.json"
  },
  "statsFile": "./errors.txt"
}
```

An example mapping file is shown below:

```json
{
  "Brand": "brand",
  "SkuName": "name",
  "ProductCode": "identifiers.gs1:01",
  "ManufactureDate": "customFields.ManufactureDate",
  "BatchId": "tags[0]",
  "PhotoUrl": "photos[0]"
}
```


## Loading Data

Load data from the `input.data` CSV file once all other configuration is in
place:

```
npm start $configFile
````

Where `$configFile` is the path to the configuration file.


## Tests

`npm test`
