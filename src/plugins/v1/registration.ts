import type {
	FastifyInstance,
	FastifyPluginCallback,
	preHandlerAsyncHookHandler,
	preHandlerHookHandler,
} from "fastify";
import {
	RegisterEndpoint,
	type PushToken,
	type RegisterParams,
} from "passkit-webservice-toolkit/v1/register.js";
import {
	UnregisterEndpoint,
	type UnregisterParams,
} from "passkit-webservice-toolkit/v1/unregister.js";
import {
	checkAuthorizationSchemeHook,
	createTokenVerifierHook,
} from "./hooks.js";

interface RegistrationPluginOptions {
	tokenVerifier?(token: string): PromiseLike<boolean>;
	/**
	 * @see https://developer.apple.com/documentation/walletpasses/register_a_pass_for_update_notifications
	 */
	onRegister(
		deviceLibraryIdentifier: string,
		passTypeIdentifier: string,
		serialNumber: string,
	): PromiseLike<void>;

	/**
	 * @see https://developer.apple.com/documentation/walletpasses/unregister_a_pass_for_update_notifications
	 */
	onUnregister(
		deviceLibraryIdentifier: string,
		passTypeIdentifier: string,
		serialNumber: string,
	): PromiseLike<void>;
}

function registrationPlugin(
	fastify: FastifyInstance,
	opts: RegistrationPluginOptions,
	done: Parameters<FastifyPluginCallback>[2],
) {
	if (typeof opts.onRegister !== "function") {
		throw new Error("onRegister is not a valid listener");
	}

	if (typeof opts.onUnregister !== "function") {
		throw new Error("onUnregister is not a valid listener");
	}

	const preHandlerHooks: (
		| preHandlerAsyncHookHandler
		| preHandlerHookHandler
	)[] = [checkAuthorizationSchemeHook];

	if (typeof opts.tokenVerifier === "function") {
		preHandlerHooks.push(createTokenVerifierHook(opts.tokenVerifier));
	}

	fastify.post<{
		Body: PushToken;
		Params: Record<RegisterParams[number], string>;
	}>(RegisterEndpoint.path, {
		prefixTrailingSlash: "no-slash",
		schema: {
			headers: {
				Authorization: { type: "string" },
			},
			params: {
				deviceLibraryIdentifier: { type: "string" },
				passTypeIdentifier: { type: "string" },
				serialNumber: { type: "string" },
			},
			body: {
				type: "object",
				properties: {
					pushToken: { type: "string" },
				},
			},
		},
		preHandler: preHandlerHooks,
		async handler(request, reply) {
			const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } =
				request.params;

			await opts.onRegister(
				deviceLibraryIdentifier,
				passTypeIdentifier,
				serialNumber,
			);

			return reply.code(200).send();
		},
	});

	fastify.delete<{
		Body: never;
		Params: Record<UnregisterParams[number], string>;
	}>(UnregisterEndpoint.path, {
		prefixTrailingSlash: "no-slash",
		schema: {
			headers: {
				Authorization: { type: "string" },
			},
			params: {
				deviceLibraryIdentifier: { type: "string" },
				passTypeIdentifier: { type: "string" },
				serialNumber: { type: "string" },
			},
		},
		preHandler: preHandlerHooks,
		async handler(request, reply) {
			const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } =
				request.params;

			await opts.onUnregister(
				deviceLibraryIdentifier,
				passTypeIdentifier,
				serialNumber,
			);

			return reply.code(200).send();
		},
	});

	done();
}

export default registrationPlugin satisfies FastifyPluginCallback<RegistrationPluginOptions>;
