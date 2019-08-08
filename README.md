# evrythng-cli-plugin-csv-loader

EVRYTHNG CLI plugin to upsert resources from a CSV file. Each use of the `load`
command performs the following:

* Read the input data CSV file.
* Validate columns match the input JSON Schema.
* Map each CSV record to an EVRYTHNG resource using the mapping file.
* Validate output resources with JSON Schema before they are created.
* Create resources, or update by a nominated key if they already exist.


## Installation

Install alongside [`evrythng-cli`](https://github.com/evrythng/evrythng-cli),
usually globally:

```bash
$ npm i -g evrythng-cli-plugin-csv-loader
```


## Usage

Initialise a set of example files:

```bash
$ evrythng csv-loader init
```

Load data from some CSV file using a set of config files:

```bash
$ evrythng csv-loader load $configPath $csvPath
```


## Quick Start

To start quickly, use the `init` command to generate a set of example files to
modify for your particular data set:

```bash
$ evrythng csv-loader init
```

This will create a directory `csv-loader-config` containing:

* `config.json` - Example config file (see below for format)
* `input.schema.json` - Example JSON Schema file describing the expected format
  of the input data CSV file.
* `output.schema.json` - Example JSON Schema file describing the expected format
  of the output EVRYTHNG resources.
* `mapping.json` - Example JSON file describing how to map each CSV field to a
  field on the EVRYTHNG resource (see below for format)


## Configuration Format

A configuration file is used to specify all other relevant files. Strict schemas
and exhaustive mapping can help ensure data integrity.

* `input`
  * `schema` - JSONSchema for CSV records after they are read.
* `output`
  * `schema` - JSONSchema for each processed EVRYTHNG resource before it is
    created.
  * `mapping` - JSON file that maps CSV column headers to EVRYTHNG resource
    field names. Sub-objects and arrays are also supported with dot and square
    bracket notation respectively.
  * `type` - Type of EVRYTHNG resource to create.
  * `updateKey` - Either `name` or some `identifiers` key to be used for
    updates.
  * `projectName` - Name of the EVRYTHNG project to use.
  * `defaultRedirectUrl` - (optional) If set, used as the product/Thng
    redirection URL. Must contain `{shortId}` or `{thngId}`/`{productId}`
    somewhere depending on the resource type.
  * `defaultShortDomain` - (optional) If set, used as the short domain for the creation of the
        redirection URLs. Needs to be set when the domain is different than the default one.

An example configuration is shown below:

```json
{
  "input": {
    "schema": "./example-config/input.schema.json"
  },
  "output": {
    "schema": "./example-config/output.schema.json",
    "mapping": "./example-config/mapping.json",
    "type": "product",
    "updateKey": "gs1:01",
    "projectName": "Example PoC",
    "defaultRedirectUrl": "https://google.com?id={shortId}",
    "defaultShortDomain": "abc.tn.gg"
  }
}
```


## Mapping Format

The `mapping.json` file describes how to map each field in a CSV record from its
header name to the EVRYTHNG resource field name.

Array fields (i.e: `tags`) are supported with square bracket notation
(e.g: `tags[0]`).

Sub-objects (i.e: `identifiers` or `customFields`) are suported with dot
notation (e.g: `identifier.gs1:01`).

A redirection can be specified using the special `redirection` mapping value.
This option overrides `defaultRedirectUrl` if it is set in the config file.

An example mapping file is shown below:

```json
{
  "Brand": "brand",
  "SkuName": "name",
  "ProductCode": "identifiers.gs1:01",
  "ManufactureDate": "customFields.ManufactureDate",
  "BatchId": "tags[0]",
  "PhotoUrl": "photos[0]",
  "SecretCode": ""
}
```

All CSV column headers must be accounted for, but they can be skipped by leaving
the mapped value as an empty string (like `SecretCode` shown above).


## Tests

Run unit tests using `mocha`:

`npm test`

Run the example config, schemas, and data in `example`:

```bash
$ evrythng csv-loader load ./example/config.json ./example/data.csv
```