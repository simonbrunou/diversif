<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import Modal from './ui/Modal.svelte';
	import Button from './ui/Button.svelte';

	type BIPEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	};

	const DISMISS_KEY = 'install-prompt-dismissed';
	const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

	let bipEvent = $state<BIPEvent | null>(null);
	let isIOS = $state(false);
	let isStandalone = $state(false);
	let dismissedRecently = $state(false);
	let modalOpen = $state(false);

	function isIOSSafari(ua: string): boolean {
		if (!/iPhone|iPad|iPod/.test(ua)) return false;
		if (/CriOS|FxiOS|EdgiOS/.test(ua)) return false;
		return true;
	}

	function readDismiss(): boolean {
		const raw = localStorage.getItem(DISMISS_KEY);
		if (!raw) return false;
		const ts = Number(raw);
		if (!Number.isFinite(ts)) return false;
		return Date.now() - ts < DISMISS_TTL_MS;
	}

	function handleBIP(event: Event) {
		event.preventDefault();
		bipEvent = event as BIPEvent;
	}

	onMount(() => {
		isIOS = isIOSSafari(navigator.userAgent);
		isStandalone = window.matchMedia('(display-mode: standalone)').matches;
		dismissedRecently = readDismiss();
		window.addEventListener('beforeinstallprompt', handleBIP);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('beforeinstallprompt', handleBIP);
		}
	});

	const showButton = $derived(!isStandalone && !dismissedRecently && (bipEvent != null || isIOS));

	async function onClick() {
		if (bipEvent) {
			await bipEvent.prompt();
			const choice = await bipEvent.userChoice;
			if (choice.outcome === 'dismissed') {
				localStorage.setItem(DISMISS_KEY, String(Date.now()));
				dismissedRecently = true;
			}
			bipEvent = null;
		} else if (isIOS) {
			modalOpen = true;
		}
	}

	function dismissModal() {
		modalOpen = false;
		localStorage.setItem(DISMISS_KEY, String(Date.now()));
		dismissedRecently = true;
	}
</script>

{#if showButton}
	<button type="button" class="install-cta" onclick={onClick}>
		{m.installCta()}
	</button>
{/if}

<Modal
	bind:open={modalOpen}
	side="center"
	title={m.installIosInstructionsTitle()}
	description={m.installIosInstructionsBody()}
	onclose={dismissModal}
>
	{#snippet footer()}
		<Button onclick={dismissModal}>{m.installIosInstructionsDismiss()}</Button>
	{/snippet}
</Modal>

<style>
	.install-cta {
		padding: 0.25rem 0.75rem;
		border-radius: 0.375rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		font-size: 0.875rem;
	}
</style>
