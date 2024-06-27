.PHONY: none ui api push-ui push-api push
all: none

VERSION=0.0.6

none:
	@echo "Please specify a target"
	@echo "    ui api push"

ui:
	docker build -t lihebi/codepod-cloud-ui:$(VERSION) . -f Dockerfile_UI

api:
	docker build -t lihebi/codepod-cloud-api:$(VERSION) . -f Dockerfile_API

push-ui:
	docker push lihebi/codepod-cloud-ui:$(VERSION)

push-api:
	docker push lihebi/codepod-cloud-api:$(VERSION)

push: push-ui push-api