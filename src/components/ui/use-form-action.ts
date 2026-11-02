"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import type { ActionState } from "@/lib/action";

type FormActionFn = (prev: ActionState, fd: FormData) => Promise<ActionState>;

// react 19 resets the form after an action, so submit manually via onSubmit.
 // also passes the clicked button name/value (intent). use formKey as the form key for resetOnOk
export function useFormAction(
  action: FormActionFn,
  opts: { resetOnOk?: boolean; onOk?: (state: NonNullable<ActionState>) => void } = {},
) {
  const [state, dispatch, pending] = useActionState(action, null);
  const [formKey, setFormKey] = useState(0);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  useEffect(() => {
    if (!state?.ok) return;
    if (optsRef.current.resetOnOk) setFormKey((k) => k + 1);
    optsRef.current.onOk?.(state);
  }, [state]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  }

  return { state, pending, onSubmit, formKey };
}
