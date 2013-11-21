gui.module ( "sync@wunderbyte.com", {

	oncontextinitialize : function (){

		/**
		 * Create synchronized instance of Type from source.
		 * @param {edb.Type} type
		 * @param {edb.Type|String} source
		 * @param {number} ways
		 * @param @optional {boolean} global
		 * @returns {edb.Type}
		 */
		function sync ( Type, source, ways, global ) {
			return edb.Sync.sync ( Type.from ( source ), ways, global );
		}

		/**
		 * Mixin recurring static methods. 
		 * Available on type constructors: 
		 * `myns.MyType.syncGlobal (src)`
		 */
		edb.Type.mixin ( null, {

			/**
			 * Create out-synchronized instance from source.
			 * @param {edb.Type|String} source
			 * @returns {edb.Type}
			 */
			syncAs : function ( source ) {
				return sync ( this, source, edb.Sync.$SYNC_AS );
			},

			/**
			 * Create in-synchronized instance from source.
			 * @param {edb.Type|String} source
			 * @returns {edb.Type}
			 */
			syncTo : function ( source ) {
				return sync ( this, source, edb.Sync.$SYNC_TO );
			},

			/**
			 * Create synchronized instance from source.
			 * @param {edb.Type|String} source
			 * @returns {edb.Type}
			 */
			sync : function ( source ) {
				return sync ( this, source, edb.Sync.$SYNC );
			},

			/**
			 * Create out-synchronized instance from source.
			 * @param {edb.Type|String} source
			 * @returns {edb.Type}
			 */
			syncGlobalAs : function ( source ) {
				return sync ( this, source, edb.Sync.$SYNC_AS, true );
			},

			/**
			 * Create in-synchronized instance from source.
			 * @param {edb.Type|String} source
			 * @returns {edb.Type}
			 */
			syncGlobalTo : function ( source ) {
				return sync ( this, source, edb.Sync.$SYNC_TO, true );
			},

			/**
			 * Create synchronized instance from source.
			 * @param {edb.Type|String} source
			 * @returns {edb.Type}
			 */
			syncGlobal : function ( source ) {
				return sync ( this, source, edb.Sync.$SYNC, true );
			}

		});
	}
});