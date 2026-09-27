'use client';
import {useEffect} from 'react';
/** If the email provider sent a verification return to a fallback page, forward it to verification. */
export function ProviderReturn(){useEffect(()=>{const h=window.location.hash;if(/access_token=|error_description=/.test(h)&&/type=(signup|magiclink)/.test(h))window.location.replace(`/signup/verify${h}`);},[]);return null;}
