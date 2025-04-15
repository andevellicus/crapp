package utils

import (
	"bytes"
	"compress/gzip"
	"io"
)

// CompressData compresses data using gzip
func CompressData(data []byte) ([]byte, error) {
	var compressed bytes.Buffer
	gw := gzip.NewWriter(&compressed)

	_, err := gw.Write(data)
	if err != nil {
		return nil, err
	}

	if err := gw.Close(); err != nil {
		return nil, err
	}

	return compressed.Bytes(), nil
}

// DecompressData decompresses gzipped data
func DecompressData(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return []byte{}, nil
	}

	gr, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer gr.Close()

	decompressed, err := io.ReadAll(gr)
	if err != nil {
		return nil, err
	}

	return decompressed, nil
}
