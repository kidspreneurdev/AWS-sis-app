export type ToastType = 'ok' | 'err' | 'info'

type Handler = (msg: string, type: ToastType) => void
let _handler: Handler | null = null

export function _registerToastHandler(fn: Handler) { _handler = fn }
export function toast(msg: string, type: ToastType = 'ok') { _handler?.(msg, type) }
