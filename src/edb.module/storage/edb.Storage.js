/**
 * An abstract storage stub. We've rigged this up to 
 * store {edb.Object} and {edb.Array} instances only.
 * @TODO propagate "context" throughout all methods.
 */
edb.Storage = gui.Class.create ( Object.prototype, {

}, { // Recurring static ...........................

	/**
	 * Let's make this async and on-demand.
	 * @throws {Error}
	 */
	length : {
		getter : function () {
			throw new Error ( "Not supported." );
		}
	},

	/**
	 * Get type.
	 * @param {String} key
	 * @param {Window|WorkerScope} context
	 * @returns {gui.Then}
	 */
	getItem : function ( key, context ) {
		var then = new gui.Then ();
		var type = this [ key ];
		if ( false && type ) { // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
			then.now ( type || null );
		} else {
			this.$getItem ( key, context, function ( type ) {
				this [ key ] = type;
				gui.Tick.next ( function () { // @TODO bug in gui.Then!
					then.now ( type || null );
				});
			});
		}
		return then;
	},

	/**
	 * Set type.
	 * @param {String} key
	 * @param {object} type
	 * @param {Window|WorkerScope} context
	 * @returns {object}
	 */
	setItem : function ( key, type, context ) {
		var then = new gui.Then ();
		if ( edb.Storage.$typecheck ( type )) {
			this.$setItem ( key, type, context, function () {
				this [ key ] = type;
				then.now ( type );
			});
		}
		return then;
	},

	/**
	 * Remove type.
	 * @param {String} key
	 */
	removeItem : function ( key ) {
		var then = new gui.Then ();
		delete this [ key ];
		this.$removeItem ( key, function () {
			then.now ();
		});
		return then;
	},

	/**
	 * Clear the store.
	 */
	clear : function () {
		var then = new gui.Then ();
		this.$clear ( function () {
			Object.keys ( this ).filter ( function ( key ) {
				return this.prototype [ key ]	=== undefined;
			}, this ).forEach ( function ( key ) {
				delete this [ key ];
			}, this );
			then.now ();
		});
		return then;
	},


	// Secrets ...........................................

	/**
	 * Get type.
	 * @param {String} key
	 * @param {edb.Model|edb.Collection} type
	 */
	$getItem : function ( key, context, callback ) {},

	/**
	 * Set type.
	 * @param {String} key
	 * @param {function} callback
	 * @param {edb.Model|edb.Collection} type
	 */
	$setItem : function ( key, type, context, callback ) {},

	/**
	 * Remove type.
	 * @param {String} key
	 * @param {function} callback
	 */
	$removeItem : function ( key, callback ) {},

	/**
	 * Clear.
	 * @param {function} callback
	 */
	$clear : function ( callback ) {}


}, { // Static ...................................................

	/**
	 * @param {object} type
	 * @returns {boolean}
	 */
	$typecheck : function ( type ) {
		if ( edb.Type.isInstance ( type )) {
			if ( type.constructor.$classname !== gui.Class.ANONYMOUS ) {
				return true;
			} else {
				throw new Error ( "Cannot persist ANONYMOUS Type" );
			}
		} else {
			throw new TypeError ( "Persist only models and collections" );
		}
	}

});