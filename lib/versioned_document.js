'use strict';

const mongodb = require('mongodb');
const Document = require('./document');

const _db_collection = Symbol();
const _db_collection_history = Symbol();

class VersionedDocument extends Document {
  constructor(db, collection_name, history_collection_name) {
    super(db, collection_name);
    this[_db_collection] = db.collection(collection_name);
    this[_db_collection_history] = db.collection(history_collection_name || collection_name + '_history');
  }

  validate() {
    return super.validate();
  }

  apply(bareObject) {
    super.apply(bareObject);
  }

  save() {
    let currVersion;

    return this[_db_collection]
      .findOne({ _id: this._id })
      .then((previous) => {
        if(!previous) {
          currVersion = 0;
          return;
        }

        previous.doc_id = previous._id;
        delete previous._id;

        currVersion = previous._v;

        return this[_db_collection_history].updateOne(
          { doc_id: previous.doc_id, _v: previous._v },
          { $set: previous },
          { upsert: true }
        );
      })
      .then((dbResponse) => {
        if(dbResponse && !dbResponse.result.upserted) {
          return Promise.reject('Cannot save new version');
        }

        let current = this;
        current._v = currVersion + 1;

        if(currVersion === 0) {
          return this[_db_collection].insert(current);
        } else {
          return this[_db_collection].updateOne(
            { _id: this._id, _v: currVersion },
            current
          );
        }
      });
  }
}

module.exports = VersionedDocument;