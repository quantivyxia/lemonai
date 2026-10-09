from rest_framework import serializers


class AssistantMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=['user', 'assistant'])
    content = serializers.CharField(max_length=4000, trim_whitespace=True)

    def validate_content(self, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError('Mensagem vazia.')
        return normalized


class AssistantPageContextSerializer(serializers.Serializer):
    key = serializers.CharField(max_length=64, trim_whitespace=True)
    title = serializers.CharField(max_length=160, trim_whitespace=True)
    path = serializers.CharField(max_length=200, trim_whitespace=True)
    description = serializers.CharField(max_length=280, trim_whitespace=True, required=False, allow_blank=True)
    is_dashboard = serializers.BooleanField(required=False, default=False)


class AssistantChatRequestSerializer(serializers.Serializer):
    dashboard_id = serializers.UUIDField(required=False, allow_null=True)
    page_context = AssistantPageContextSerializer(required=False)
    messages = AssistantMessageSerializer(many=True)

    def validate_messages(self, value):
        if not value:
            raise serializers.ValidationError('Envie ao menos uma mensagem.')

        trimmed_messages = value[-12:]
        if trimmed_messages[-1]['role'] != 'user':
            raise serializers.ValidationError('A ultima mensagem precisa ser do usuario.')

        return trimmed_messages

