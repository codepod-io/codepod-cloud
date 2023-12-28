docker:
	docker build -t codepod-cloud .
	docker build -t codepod-cloud-runtime -f Dockerfile.runtime .