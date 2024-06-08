.PHONY: python julia push
all: python julia

VERSION=0.5.1-alpha.2

python:
	docker build -t lihebi/codepod-kernel-python:$(VERSION) ./python

julia:
	docker build -t lihebi/codepod-kernel-julia:$(VERSION) ./julia


push:
	docker push lihebi/codepod-kernel-python:$(VERSION)
	docker push lihebi/codepod-kernel-julia:$(VERSION)