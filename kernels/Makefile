.PHONY: python julia push javascript racket
all: python julia javascript racket

VERSION=0.5.1-alpha.2

python:
	docker build -t lihebi/codepod-kernel-python:$(VERSION) ./python

julia:
	docker build -t lihebi/codepod-kernel-julia:$(VERSION) ./julia

javascript:
	docker build -t lihebi/codepod-kernel-javascript:$(VERSION) ./javascript

racket:
	docker build -t lihebi/codepod-kernel-racket:$(VERSION) ./racket


push:
	docker push lihebi/codepod-kernel-python:$(VERSION)
	docker push lihebi/codepod-kernel-julia:$(VERSION)
	docker push lihebi/codepod-kernel-javascript:$(VERSION)
	docker push lihebi/codepod-kernel-racket:$(VERSION)