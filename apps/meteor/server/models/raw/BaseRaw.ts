import {
	ChangeStream,
	Collection,
	CollectionInsertOneOptions,
	CommonOptions,
	Cursor,
	Db,
	DbCollectionOptions,
	DeleteWriteOpResultObject,
	FilterQuery,
	FindAndModifyWriteOpResultObject,
	FindOneAndUpdateOption,
	FindOneOptions,
	IndexSpecification,
	InsertOneWriteOpResult,
	InsertWriteOpResult,
	ObjectID,
	OptionalId,
	UpdateManyOptions,
	UpdateOneOptions,
	UpdateQuery,
	UpdateWriteOpResult,
	WithId,
	WithoutProjection,
	WriteOpResult,
} from 'mongodb';
import type { IRocketChatRecord, RocketChatRecordDeleted } from '@rocket.chat/core-typings';
import type { IBaseModel, DefaultFields, ResultFields, InsertionModel } from '@rocket.chat/model-typings';

import { setUpdatedAt } from '../../../app/models/server/lib/setUpdatedAt';

const warnFields =
	process.env.NODE_ENV !== 'production'
		? (...rest: any): void => {
				console.warn(...rest, new Error().stack);
		  }
		: new Function();

type ModelOptions = {
	preventSetUpdatedAt?: boolean;
	collection?: DbCollectionOptions;
};

export abstract class BaseRaw<T, C extends DefaultFields<T> = undefined> implements IBaseModel<T, C> {
	public readonly defaultFields: C;

	public readonly col: Collection<T>;

	private preventSetUpdatedAt: boolean;

	constructor(private db: Db, protected name: string, protected trash?: Collection<RocketChatRecordDeleted<T>>, options?: ModelOptions) {
		this.col = this.db.collection(name, options?.collection || {});

		const indexes = this.modelIndexes();
		if (indexes?.length) {
			this.col.createIndexes(indexes).catch((e) => {
				console.warn(`Some indexes for collection '${this.name}' could not be created:\n\t${e.message}`);
			});
		}

		this.preventSetUpdatedAt = options?.preventSetUpdatedAt ?? false;
	}

	protected modelIndexes(): IndexSpecification[] | void {
		// noop
	}

	private doNotMixInclusionAndExclusionFields(options: FindOneOptions<T> | WithoutProjection<FindOneOptions<T>> = {}): FindOneOptions<T> {
		const optionsDef = this.ensureDefaultFields(options);
		if (optionsDef?.projection === undefined) {
			return optionsDef;
		}

		const projection: Record<string, any> = optionsDef?.projection;
		const keys = Object.keys(projection);
		const removeKeys = keys.filter((key) => projection[key] === 0);
		if (keys.length > removeKeys.length) {
			removeKeys.forEach((key) => delete projection[key]);
		}

		return {
			...optionsDef,
			projection,
		};
	}

	private ensureDefaultFields(options?: undefined): C extends void ? undefined : WithoutProjection<FindOneOptions<T>>;

	private ensureDefaultFields(options: WithoutProjection<FindOneOptions<T>>): WithoutProjection<FindOneOptions<T>>;

	private ensureDefaultFields<P>(options: FindOneOptions<P>): FindOneOptions<P>;

	private ensureDefaultFields<P>(options?: any): FindOneOptions<P> | undefined | WithoutProjection<FindOneOptions<T>> {
		if (this.defaultFields === undefined) {
			return options;
		}

		const { fields: deprecatedFields, projection, ...rest } = options || {};

		if (deprecatedFields) {
			warnFields("Using 'fields' in models is deprecated.", options);
		}

		const fields = { ...deprecatedFields, ...projection };

		return {
			projection: this.defaultFields,
			...(fields && Object.values(fields).length && { projection: fields }),
			...rest,
		};
	}

	public findOneAndUpdate(
		query: FilterQuery<T>,
		update: UpdateQuery<T> | T,
		options?: FindOneAndUpdateOption<T>,
	): Promise<FindAndModifyWriteOpResultObject<T>> {
		return this.col.findOneAndUpdate(query, update, options);
	}

	async findOneById(_id: string, options?: WithoutProjection<FindOneOptions<T>>): Promise<T | null>;

	async findOneById<P>(_id: string, options: FindOneOptions<P extends T ? T : P>): Promise<P | null>;

	async findOneById<P>(
		_id: string,
		options?: WithoutProjection<FindOneOptions<T>> | FindOneOptions<P extends T ? T : P>,
	): Promise<T | P | null> {
		const query = { _id } as FilterQuery<T>;
		const optionsDef = this.doNotMixInclusionAndExclusionFields(options as WithoutProjection<FindOneOptions<T>>) as WithoutProjection<
			FindOneOptions<T>
		>;
		return this.col.findOne(query, optionsDef);
	}

	async findOne(query?: FilterQuery<T> | string, options?: undefined): Promise<T | null>;

	async findOne(query: FilterQuery<T> | string, options: WithoutProjection<FindOneOptions<T>>): Promise<T | null>;

	async findOne<P>(query: FilterQuery<T> | string, options: FindOneOptions<P extends T ? T : P>): Promise<P | null>;

	async findOne<P>(
		query: FilterQuery<T> | string = {},
		options?: WithoutProjection<FindOneOptions<T>> | FindOneOptions<P extends T ? T : P>,
	): Promise<T | P | null> {
		const q = typeof query === 'string' ? ({ _id: query } as FilterQuery<T>) : query;

		const optionsDef = this.doNotMixInclusionAndExclusionFields(options as WithoutProjection<FindOneOptions<T>>) as WithoutProjection<
			FindOneOptions<T>
		>;
		return this.col.findOne(q, optionsDef);
	}

	// findUsersInRoles(): void {
	// 	throw new Error('[overwrite-function] You must overwrite this function in the extended classes');
	// }

	find(query?: FilterQuery<T>): Cursor<ResultFields<T, C>>;

	find(query: FilterQuery<T>, options: WithoutProjection<FindOneOptions<T>>): Cursor<ResultFields<T, C>>;

	find<P = T>(query: FilterQuery<T>, options: FindOneOptions<P extends T ? T : P>): Cursor<P>;

	find<P>(
		query: FilterQuery<T> | undefined = {},
		options?: WithoutProjection<FindOneOptions<T>> | FindOneOptions<P extends T ? T : P>,
	): Cursor<P> | Cursor<T> {
		const optionsDef = this.doNotMixInclusionAndExclusionFields(options as WithoutProjection<FindOneOptions<T>>) as WithoutProjection<
			FindOneOptions<T>
		>;
		return this.col.find(query, optionsDef);
	}

	update(
		filter: FilterQuery<T>,
		update: UpdateQuery<T> | Partial<T>,
		options?: UpdateOneOptions & { multi?: boolean },
	): Promise<WriteOpResult> {
		this.setUpdatedAt(update);
		return this.col.update(filter, update, options);
	}

	updateOne(
		filter: FilterQuery<T>,
		update: UpdateQuery<T> | Partial<T>,
		options?: UpdateOneOptions & { multi?: boolean },
	): Promise<UpdateWriteOpResult> {
		this.setUpdatedAt(update);
		return this.col.updateOne(filter, update, options);
	}

	updateMany(filter: FilterQuery<T>, update: UpdateQuery<T> | Partial<T>, options?: UpdateManyOptions): Promise<UpdateWriteOpResult> {
		this.setUpdatedAt(update);
		return this.col.updateMany(filter, update, options);
	}

	insertMany(docs: Array<InsertionModel<T>>, options?: CollectionInsertOneOptions): Promise<InsertWriteOpResult<WithId<T>>> {
		docs = docs.map((doc) => {
			if (!doc._id || typeof doc._id !== 'string') {
				const oid = new ObjectID();
				return { _id: oid.toHexString(), ...doc };
			}
			this.setUpdatedAt(doc);
			return doc;
		});

		// TODO reavaluate following type casting
		return this.col.insertMany(docs as unknown as Array<OptionalId<T>>, options);
	}

	insertOne(doc: InsertionModel<T>, options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult<WithId<T>>> {
		if (!doc._id || typeof doc._id !== 'string') {
			const oid = new ObjectID();
			doc = { _id: oid.toHexString(), ...doc };
		}

		this.setUpdatedAt(doc);

		// TODO reavaluate following type casting
		return this.col.insertOne(doc as unknown as OptionalId<T>, options);
	}

	removeById(_id: string): Promise<DeleteWriteOpResultObject> {
		return this.deleteOne({ _id } as FilterQuery<T>);
	}

	async deleteOne(
		filter: FilterQuery<T>,
		options?: CommonOptions & { bypassDocumentValidation?: boolean },
	): Promise<DeleteWriteOpResultObject> {
		if (!this.trash) {
			return this.col.deleteOne(filter, options);
		}

		const doc = (await this.findOne(filter)) as unknown as (IRocketChatRecord & T) | undefined;

		if (doc) {
			const { _id, ...record } = doc;

			const trash = {
				...record,

				_deletedAt: new Date(),
				__collection__: this.name,
			} as RocketChatRecordDeleted<T>;

			// since the operation is not atomic, we need to make sure that the record is not already deleted/inserted
			await this.trash?.updateOne(
				{ _id } as FilterQuery<RocketChatRecordDeleted<T>>,
				{ $set: trash },
				{
					upsert: true,
				},
			);
		}

		return this.col.deleteOne(filter, options);
	}

	async deleteMany(filter: FilterQuery<T>, options?: CommonOptions): Promise<DeleteWriteOpResultObject> {
		if (!this.trash) {
			return this.col.deleteMany(filter, options);
		}

		const cursor = this.find(filter);

		const ids: string[] = [];
		for await (const doc of cursor) {
			const { _id, ...record } = doc as unknown as IRocketChatRecord & T;

			const trash = {
				...record,

				_deletedAt: new Date(),
				__collection__: this.name,
			} as RocketChatRecordDeleted<T>;

			ids.push(_id);

			// since the operation is not atomic, we need to make sure that the record is not already deleted/inserted
			await this.trash?.updateOne(
				{ _id } as FilterQuery<RocketChatRecordDeleted<T>>,
				{ $set: trash },
				{
					upsert: true,
				},
			);
		}

		return this.col.deleteMany({ _id: { $in: ids } } as unknown as FilterQuery<T>, options);
	}

	// Trash
	trashFind<P extends RocketChatRecordDeleted<T>>(
		query: FilterQuery<RocketChatRecordDeleted<T>>,
		options: FindOneOptions<P extends RocketChatRecordDeleted<T> ? RocketChatRecordDeleted<T> : P>,
	): Cursor<RocketChatRecordDeleted<T>> | undefined {
		if (!this.trash) {
			return undefined;
		}
		const { trash } = this;

		return trash.find(
			{
				__collection__: this.name,
				...query,
			},
			options,
		);
	}

	trashFindOneById(_id: string): Promise<RocketChatRecordDeleted<T> | null>;

	trashFindOneById(
		_id: string,
		options: WithoutProjection<RocketChatRecordDeleted<T>>,
	): Promise<RocketChatRecordDeleted<RocketChatRecordDeleted<T>> | null>;

	trashFindOneById<P>(
		_id: string,
		options: FindOneOptions<P extends RocketChatRecordDeleted<T> ? RocketChatRecordDeleted<T> : P>,
	): Promise<P | null>;

	async trashFindOneById<P extends RocketChatRecordDeleted<T>>(
		_id: string,
		options?:
			| undefined
			| WithoutProjection<RocketChatRecordDeleted<T>>
			| FindOneOptions<P extends RocketChatRecordDeleted<T> ? RocketChatRecordDeleted<T> : P>,
	): Promise<RocketChatRecordDeleted<P> | null> {
		const query = {
			_id,
			__collection__: this.name,
		} as FilterQuery<RocketChatRecordDeleted<T>>;

		if (!this.trash) {
			return null;
		}
		const { trash } = this;

		return trash.findOne(query, options);
	}

	private setUpdatedAt(record: UpdateQuery<T> | InsertionModel<T>): void {
		if (this.preventSetUpdatedAt) {
			return;
		}
		setUpdatedAt(record);
	}

	trashFindDeletedAfter(deletedAt: Date): Cursor<RocketChatRecordDeleted<T>>;

	trashFindDeletedAfter(
		deletedAt: Date,
		query: FilterQuery<RocketChatRecordDeleted<T>>,
		options: WithoutProjection<RocketChatRecordDeleted<T>>,
	): Cursor<RocketChatRecordDeleted<T>>;

	trashFindDeletedAfter<P = RocketChatRecordDeleted<T>>(
		deletedAt: Date,
		query: FilterQuery<P>,
		options: FindOneOptions<P extends RocketChatRecordDeleted<T> ? RocketChatRecordDeleted<T> : P>,
	): Cursor<RocketChatRecordDeleted<P>>;

	trashFindDeletedAfter<P = RocketChatRecordDeleted<T>>(
		deletedAt: Date,
		query?: FilterQuery<RocketChatRecordDeleted<T>>,
		options?:
			| WithoutProjection<RocketChatRecordDeleted<T>>
			| FindOneOptions<P extends RocketChatRecordDeleted<T> ? RocketChatRecordDeleted<T> : P>,
	): Cursor<RocketChatRecordDeleted<T>> {
		const q = {
			__collection__: this.name,
			_deletedAt: {
				$gt: deletedAt,
			},
			...query,
		} as FilterQuery<RocketChatRecordDeleted<T>>;

		const { trash } = this;

		if (!trash) {
			throw new Error('Trash is not enabled for this collection');
		}

		return trash.find(q, options as any);
	}

	watch(pipeline?: object[]): ChangeStream<T> {
		return this.col.watch(pipeline);
	}
}