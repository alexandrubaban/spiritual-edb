/**
 * @TODO: nuke this thing on type dispose
 * @param {edb.Type} type
 */
edb.SyncJohn = function ( type ) {
	this.type = type;
};

edb.SyncJohn.prototype = {

	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} b
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

	/**
	 * Change type somehow.
	 * @param {edb.Object|edb.Array} type
	 * @param {edb.ObjectSync|edb.ArraySync} c
	 */
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

	/**
	 * Change object properties.
	 * @param {edb.Object|edb.Array} type
	 * @param {edb.ObjectSync|edb.ArraySync} c
	 */
	_objectchange : function ( type, c ) {
		if ( type [ c.name ] !== c.newValue ) {
			type.$willsync = true;
			type [ c.name ] = c.newValue;
			/*
			console.log ( c.name, c.newValue );
			if ( edb.Type.is ( type [ c.name ])) {
				console.log ( document.title, c.name, type [ c.name ]);
			}
			*/
		}
	},

	/**
	 * Change array structure.
	 * @param {edb.Array} type
	 * @param {edb.ArraySync} c
	 */
	_arraychange : function ( type, c ) {
		type.$willsync = true;
		type.splice.apply ( type, c.args );
		/*
		c.args.slice ( 2 ).forEach ( function ( added ) {
			console.log ( type + " added", added, document.title );
		});
		*/
	}
};