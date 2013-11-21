/**
 * @TODO: nuke this thing on type dispose
 * @param {edb.Type} type
 */
edb.SyncJohn = function ( type ) {
	this.type = type;
};

edb.SyncJohn.prototype = {

	/**
	 * [onbroadcast description]
	 * @param  {[type]} b [description]
	 * @return {[type]}   [description]
	 */
	onbroadcast : function ( b ) {
		var type = this.type;
		var changes = b.data;
		if ( changes.some ( function ( c ) {
			return c.$instanceid !== type.$instanceid;
		})) {
			changes.forEach ( function ( c ) {
				this._change ( type, c );
			}, this );
		}
	},

	_change : function ( type, c ) {
		switch ( c.type ) {
			case edb.ObjectChange.TYPE_UPDATE :
				this._objectchange ( type, c );
				break;
			case edb.ArrayChange.TYPE_SPLICE :
				this._arraychange ( type, c );
				break;
		}
	},

	_objectchange : function ( type, c ) {
		if ( type [ c.name ] !== c.newValue ) {
			type.$willsync = true;
			type [ c.name ] = c.newValue;
		}
	},

	/**
	 * @TODO: Make sure that change does mutate 
	 * the array before we mark as willsync...
	 */
	_arraychange : function ( type, c ) {
		type.$willsync = true;
		type.splice.apply ( type, c.args );
	}
};