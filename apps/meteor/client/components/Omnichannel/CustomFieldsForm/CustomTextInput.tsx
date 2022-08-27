import { Field, TextInput } from '@rocket.chat/fuselage';
import type { OmnichannelCustomFieldEndpointPayload } from '@rocket.chat/rest-typings';
import { useTranslation } from '@rocket.chat/ui-contexts';
import React, { forwardRef, ReactElement, useMemo } from 'react';
import { useFormContext, UseFormRegisterReturn } from 'react-hook-form';

export const CustomTextInput = forwardRef<
	HTMLInputElement,
	UseFormRegisterReturn & {
		data: OmnichannelCustomFieldEndpointPayload;
	}
>(function CustomTextInput({ name, data, onChange }, ref): ReactElement {
	const t = useTranslation();
	const {
		formState: { errors },
	} = useFormContext();

	const errorMessage = useMemo(() => {
		if (errors?.livechatData && errors?.livechatData[data._id]?.type === 'regexp') {
			return t('The_field_is_not_valid', data.label);
		}

		if (errors?.livechatData && errors?.livechatData[data._id]?.type === 'required') {
			return t('The_field_is_required', data.label);
		}
	}, [data._id, data.label, errors?.livechatData, t]);

	return (
		<Field>
			<Field.Label>
				{data.label}
				{data.required && '*'}
			</Field.Label>
			<Field.Row>
				<TextInput
					name={name}
					ref={ref}
					defaultValue={data.defaultValue}
					required={data.required}
					error={errorMessage}
					flexGrow={1}
					onChange={onChange}
					visibility={data.visibility}
				/>
			</Field.Row>
			<Field.Error>{errorMessage}</Field.Error>
		</Field>
	);
});
