import {
	FastifyInstance,
	FastifyPluginAsync,
	onSendAsyncHookHandler,
	onSendHookHandler,
} from "fastify";
import {
	ListEndpoint,
	type ListParams,
	type SerialNumbers,
} from "passkit-webservice-toolkit/v1/list.js";
import { HandlerNotFoundError } from "../../HandlerNotFoundError.js";
import { createResponsePayloadValidityCheckerHook } from "./hooks.js";

/**
 * @see https://developer.apple.com/documentation/walletpasses/get_the_list_of_updatable_passes
 */

interface ListPluginOptions<LastUpdatedFormat> {
	onListRetrieve(
		deviceLibraryIdentifier: string,
		passTypeIdentifier: string,
		filters: { previousLastUpdated?: LastUpdatedFormat },
	): PromiseLike<SerialNumbers | undefined>;
}

async function listPlugin<LastUpdatedFormat = unknown>(
	fastify: FastifyInstance,
	opts: ListPluginOptions<LastUpdatedFormat>,
) {
	if (typeof opts.onListRetrieve !== "function") {
		throw new HandlerNotFoundError("onListRetrieve", "ListPlugin");
	}

	const onSendHooks: (onSendAsyncHookHandler | onSendHookHandler)[] = [
		createResponsePayloadValidityCheckerHook(
			"{ serialNumbers: string[], lastUpdated: string; }",
			(payload: unknown, statusCode: number) => {
				if (statusCode === 204) {
					return true;
				}

				if (Buffer.isBuffer(payload) || payload instanceof Stream.Stream) {
					return false;
				}

				const payloadObj = JSON.parse(payload as string);
				return "serialNumbers" in payloadObj;
			},
		),
	];

	fastify.post<{
		Params: Record<ListParams[number], string>;
		Querystring: {
			previousLastUpdated?: LastUpdatedFormat;
		};
	}>(ListEndpoint.path, {
		prefixTrailingSlash: "no-slash",
		schema: {
			headers: {
				Authorization: { type: "string" },
			},
			params: {
				deviceLibraryIdentifier: { type: "string" },
				passTypeIdentifier: { type: "string" },
			},
			response: {
				200: {
					content: {
						"application/json": {
							type: "object",
							properties: {
								serialNumbers: {
									type: "array",
									items: { type: "string" },
								},
								lastUpdated: { type: "string" },
							},
						},
					},
				},
				204: {},
			},
		},
		onSend: onSendHooks,
		async handler(request, reply) {
			const { deviceLibraryIdentifier, passTypeIdentifier } = request.params;
			const filters: { previousLastUpdated?: LastUpdatedFormat } = {
				previousLastUpdated: undefined,
			};

			if (request.query.previousLastUpdated) {
				filters.previousLastUpdated = request.query.previousLastUpdated;
			}

			const retrieve = await opts.onListRetrieve(
				deviceLibraryIdentifier,
				passTypeIdentifier,
				filters,
			);

			if (!retrieve) {
				reply.code(204).send();
				return;
			}

			reply.header("Content-Type", "application/json");

			return reply.code(200).send(JSON.stringify(retrieve));
		},
	});
}

export default listPlugin satisfies FastifyPluginAsync<
	ListPluginOptions<unknown>
>;
